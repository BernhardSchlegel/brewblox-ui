import { PersistentPart, Transitions, FlowPart, CalculatedFlows, LiquidFlow, FlowRoute, ComponentSettings } from './state';
import { DEFAULT_FRICTION, MIXED_LIQUIDS, RIGHT } from './getters';
import { Coordinates } from '@/helpers/coordinates';
import settings from './settings';
import has from 'lodash/has';
import get from 'lodash/get';
import set from 'lodash/set';
import { toASCII } from 'punycode';
import { setMaxListeners } from 'cluster';

export const isSamePart =
  (left: PersistentPart, right: PersistentPart): boolean =>
    ['x', 'y', 'type', 'rotate'].every(k => left[k] === right[k]);

export const partSettings =
  (part: PersistentPart): ComponentSettings => settings[part.type];

export const partTransitions =
  (part: PersistentPart): Transitions => partSettings(part).transitions(part);

const adjacentPart = (
  allParts: FlowPart[],
  outCoords: string,
  currentPart: FlowPart | null = null,
): FlowPart | undefined =>
  allParts
    .find((part: FlowPart) =>
      !(currentPart && isSamePart(part, currentPart))
      && has(part, ['transitions', outCoords]));

const hasIndependentTransitions = (part: FlowPart): boolean => part.type === 'BridgeTube';

const normalizeFlows = (part: FlowPart): FlowPart => {
  if (!part.flows) {
    return { ...part, flows: {} };
  }
  const newFlows = Object.entries(part.flows)
    .reduce((acc, [inCoord, flow]: [string, LiquidFlow]) => {
      const nullCoord = new Coordinates(inCoord)
        .translate([-part.x, -part.y])
        .rotate(-part.rotate)
        .toString();
      return { ...acc, [nullCoord]: flow };
    },
      {},
    );
  return { ...part, flows: newFlows };
};


const translations = (part: PersistentPart): Transitions =>
  Object.entries(partTransitions(part))
    .reduce((acc, [inCoords, transition]: [string, any]) => {
      const updatedKey = new Coordinates(inCoords)
        .rotate(part.rotate)
        .translate([part.x, part.y])
        .toString();
      const updatedTransition = transition
        .map((transition: FlowRoute) => ({
          ...transition,
          outCoords: new Coordinates(transition.outCoords)
            .rotate(part.rotate)
            .translate([part.x, part.y])
            .toString(),
        }));
      return { ...acc, [updatedKey]: updatedTransition };
    },
      {},
    );

export const asFlowParts = (parts: PersistentPart[]): FlowPart[] =>
  parts.map(part => ({ ...part, transitions: translations(part), flows: {} }));

const combineFlows =
  (left: CalculatedFlows = {}, right: CalculatedFlows = {}): CalculatedFlows => {
    const combined: CalculatedFlows = left;
    Object.entries(right)
      .forEach(([coord, flows]: [string, LiquidFlow]) => {
        Object.entries(flows)
          .forEach(([liquid, flowValue]: [string, number]) => {
            set(combined, [coord, liquid], get(combined, [coord, liquid], 0) + flowValue);
          });
      });
    return combined;
  };


const mergeFlows = (flows: CalculatedFlows): CalculatedFlows =>
  Object.entries(flows)
    .reduce((mergedFlows, [coord, coordFlows]: [string, LiquidFlow]): CalculatedFlows => {
      let positive: LiquidFlow = {};
      let negative: LiquidFlow = {};
      let posTotal = 0;
      let negTotal = 0;
      Object.entries(coordFlows).forEach(([liquid, flow]) => {
        if (flow > 0) {
          positive = { ...positive, [liquid]: flow };
          posTotal += flow;
        }
        else {
          negative = { ...negative, [liquid]: flow };
          negTotal += flow;
        }
      });
      let totalFlow = posTotal + negTotal;

      const scale = (unscaledFlows: LiquidFlow, factor: number): LiquidFlow =>
        Object.entries(unscaledFlows)
          .reduce((acc, [liquid, flowVal]: [string, number]): LiquidFlow => (
            {
              ...acc,
              [liquid]: flowVal * factor,
            })
            , {});

      let toMerge: LiquidFlow = coordFlows;
      // if flow exists in both directions, only keep the biggest and scale it down to the net flow
      if (posTotal !== 0 && negTotal !== 0 && totalFlow !== 0) {
        if (posTotal >= -negTotal) {
          toMerge = scale(positive, totalFlow / posTotal);
          totalFlow = posTotal;
        }
        else {
          toMerge = scale(negative, totalFlow / negTotal);
          totalFlow = negTotal;
        }
      }
      const acceleration = toMerge['*ACCELERATE_OTHERS*']; // special liquid type set by pumps
      if (acceleration) {
        if (totalFlow !== acceleration) {
          toMerge = scale(toMerge, totalFlow / (totalFlow - acceleration));
        }
        delete toMerge['*ACCELERATE_OTHERS*'];
      }
      if (toMerge === {}) {
        return mergedFlows;
      }
      return {
        ...mergedFlows,
        [coord]: toMerge,
      };
    },
      {});

/*
  Find the part in allParts, and then merge the new flow into allParts.
*/
const additionalFlow = (
  part: FlowPart,
  allParts: FlowPart[],
  flowToAdd: CalculatedFlows,
): FlowPart[] =>
  allParts
    .map((item) => {
      if (isSamePart(part, item)) {
        return {
          ...item,
          flows: combineFlows(item.flows, flowToAdd),
        };
      }
      return item;
    });


export class FlowSegment {
  public constructor(part: FlowPart, transitions: Transitions) {
    this.root = part;
    this.transitions = transitions;
  }

  public transitions: Transitions;
  public root: FlowPart;
  public splits: FlowSegment[] = [];
  public next: FlowSegment | null = null;

  public addChild(segment: FlowSegment): void {
    if (this.splits.length == 0) {
      if (this.next !== null) {
        this.splits.push(this.next); // move next to splits
        this.splits.push(segment); // add other segment to splits
        this.next = null; // set next to null for no shared next
      }
      else {
        this.next = segment;
      }
    }
    else {
      this.splits.push(segment);
    }
  }

  public friction(): number {
    let series = DEFAULT_FRICTION;
    let parallel = 0;
    this.splits.forEach(splitPath => {
      const splitFriction = splitPath.friction();
      if (parallel === 0) {
        parallel = splitFriction;
      }
      else {
        parallel = parallel * splitFriction / (parallel + splitFriction);
      }
    });
    if (this.next !== null) {
      series += this.next.friction();
    }
    return parallel + series;
  }

  public reduceSegments(func: (acc: any, segment: FlowSegment) => any, acc: any): any {
    acc = func(acc, this);
    this.splits.forEach((child) => {
      acc = child.reduceSegments(func, acc);
    });
    if (this.next !== null) {
      acc = func(acc, this.next);
    }
  };

  public isSameSegment(other: FlowSegment): boolean {
    return JSON.stringify(this) === JSON.stringify(other);
  }

  public leafSegments(): FlowSegment[] {
    if (this.splits.length !== 0) {
      return this.splits.reduce((acc, child) => [...acc, ...child.leafSegments()], new Array<FlowSegment>());
    }
    if (this.next !== null) {
      return this.next.leafSegments();
    }
    return [this];
  }

  public removeLeafSegment(segment: FlowSegment): void {
    this.splits.forEach((child) => child.removeLeafSegment(segment));
    if (this.next !== null) {
      if (this.next.isSameSegment(segment)) {
        this.next = null;
        return;
      }
      else {
        this.next.removeLeafSegment(segment);
      }
    }
  }

  public popDuplicatedLeaves(): FlowSegment | null {
    const leaves = this.leafSegments();
    if (leaves.length !== 0 && leaves.every(v => v.isSameSegment(leaves[0]))) {
      const combinedTransitions = leaves.reduce((acc: Transitions, leaf) => ({ ...acc, ...leaf.transitions }), {});
      leaves[0].transitions = combinedTransitions;
      this.removeLeafSegment(leaves[0]);
      return leaves[0];
    }
    return null;
  }
}

export const flowPath = (
  parts: FlowPart[],
  start: FlowPart,
  inCoord: string,
  startCoord: string = inCoord): FlowSegment | null => {
  const outFlows = get(start, ['transitions', inCoord], []);
  const path = new FlowSegment(start, {});
  const candidateParts = parts
    .filter(candidate => !isSamePart(start, candidate) || hasIndependentTransitions(candidate));

  if (outFlows !== null) {
    outFlows.forEach(outFlow => {
      const nextPart = adjacentPart(candidateParts, outFlow.outCoords, start);
      let nextPath: FlowSegment | null = null;
      if (nextPart !== undefined && outFlow.outCoords !== startCoord) {
        nextPath = flowPath(candidateParts, nextPart, outFlow.outCoords, startCoord);
        if (nextPath !== null) {
          path.addChild(nextPath);
        }
      }
      if (nextPath !== null || outFlow.outCoords === startCoord) {
        if (path.transitions[inCoord] === undefined) {
          path.transitions[inCoord] = [outFlow];
        }
        else {
          path.transitions[inCoord].push(outFlow);
        }
      }
    });
  }
  if (path.transitions[inCoord] === undefined) {
    return null;
  }

  while (true) {
    if (path.splits.length !== 0) {
      const duplicated = path.popDuplicatedLeaves();
      if (duplicated !== null) {
        if (path.next === null) {
          path.next = duplicated;
        }
        else {
          duplicated.addChild(path.next);
          path.next = duplicated;
        }
      }
      else {
        return path;
      }
    }
    else {
      break;
    }
  }
  return path;
};


export const addFlowForSegment = (
  parts: FlowPart[],
  segment: FlowSegment,
  flows: LiquidFlow,
): FlowPart[] => {

  let inFlow: CalculatedFlows = {};
  let outFlow: CalculatedFlows = {};

  // add flow for root part
  Object.entries(segment.transitions)
    .forEach(([inCoords, outFlows]) => {
      inFlow[inCoords] = Object.entries(flows)
        .reduce((acc, [k, v]: [string, number]) => ({ ...acc, [k]: -v }), {});
      if (segment.splits.length === 0) { // for split path, outflow is handled below to split it
        outFlow = outFlows.reduce((acc: CalculatedFlows, v: FlowRoute) => (
          {
            ...acc,
            [v.outCoords]: {
              ...flows,
            },
          }
        ), {});
      }
    });


  if (segment.splits.length !== 0) {
    // divide flow for split
    const frictionInvTotal = segment.splits
      .reduce((acc, split) => acc + 1 / split.friction(), 0);
    segment.splits
      .forEach((child) => {
        const invFriction = 1 / child.friction();
        const splitFlows: LiquidFlow = Object.entries(flows)
          .reduce((acc, [liquid, flowVal]: [string, number]) => ({
            ...acc,
            [liquid]: flowVal * invFriction / frictionInvTotal,
          }), {});
        const childTransition = Object.entries(child.transitions);
        const childInCoords = childTransition[0][0];
        Object.entries(splitFlows).forEach(([liquid, flowVal]: [string, number]) => {
          set(outFlow, [childInCoords, liquid], get(outFlow, [childInCoords, liquid], 0) + flowVal);
        });
        parts = addFlowForSegment(parts, child, splitFlows);
      });
  }

  parts = additionalFlow(
    segment.root,
    parts,
    {
      ...inFlow,
      ...outFlow,
    }
  );

  // add flow for next
  if (segment.next) {
    parts = addFlowForSegment(parts, segment.next, flows);
  }

  return parts;
};

export const calculateFlows = (parts: FlowPart[]): FlowPart[] => {
  // total flow is a superposition of all pressure sources in the system
  return parts.reduce((parts, part): FlowPart[] => {
    Object.entries(part.transitions).forEach(([inCoords, outFlows]) => {
      outFlows.forEach(outFlow => {
        const pressure: number = outFlow.pressure || 0;
        const liquids: string[] | undefined = outFlow.liquids;
        if (pressure && Array.isArray(liquids)) {
          const path = flowPath(parts, part, inCoords);
          if (path !== null) {
            const startFlow = liquids
              .reduce((acc: LiquidFlow, liquid: string) => ({
                ...acc,
                [liquid]: pressure / path.friction(),
              }), {});
            parts = addFlowForSegment(parts, path, startFlow);
          }
        }
      });
    });
    return parts;
  }, parts)
    .map(part => ({ ...part, flows: mergeFlows(part.flows) }));
};

export const calculateNormalizedFlows = (parts: PersistentPart[]): FlowPart[] => {
  return calculateFlows(asFlowParts(parts)).map(normalizeFlows);
};
