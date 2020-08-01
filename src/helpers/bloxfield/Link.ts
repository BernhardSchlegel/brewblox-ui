import { isBloxField } from './BloxField';
import { BlockOrIntfType, JSBloxField, Link } from './types';

export const isLink =
  (obj: any): obj is Link =>
    isBloxField(obj)
    && obj.__bloxtype === 'Link';

export const isJSLink =
  (obj: any): obj is JSLink =>
    isLink(obj)
    && 'postfix' in obj;

export const prettyLink = (v: Link): string => {
  return v?.id || '<not set>';
};

export function rawLink(id: string | null, type: BlockOrIntfType | null, driven: boolean): Link;
export function rawLink(id: string | null, type: BlockOrIntfType | null): Link;
export function rawLink(id: string | null): Link;
export function rawLink(raw: Link): Link;
export function rawLink(value: Link | string | null, type?: BlockOrIntfType | null, driven?: boolean): Link {
  return isLink(value)
    ? {
      __bloxtype: 'Link',
      id: value.id ?? null,
      type: value.type ?? null,
      driven: value.driven,
    }
    : {
      __bloxtype: 'Link',
      id: value,
      type: type ?? null,
      driven,
    };
}

export class JSLink implements JSBloxField, Link {
  public readonly __bloxtype = 'Link';
  public id: string | null;
  public type: BlockOrIntfType | null;
  public driven: boolean;

  public constructor(id: string | null, type: BlockOrIntfType | null, driven: boolean);
  public constructor(id: string | null, type: BlockOrIntfType | null);
  public constructor(id: string | null);
  public constructor(raw: Link);
  public constructor(value: Link | string | null, type?: BlockOrIntfType | null, driven?: boolean) {
    const obj = rawLink(value as any, type as any, driven as any);
    this.id = obj.id;
    this.type = obj.type as BlockOrIntfType;
    this.driven = obj.driven ?? false;
  }

  public get postfix(): string {
    const typeStr = this.type ?? '';
    const drivenStr = this.driven ? ',driven' : '';
    return `<${typeStr}${drivenStr}>`;
  }

  public toString(): string {
    return prettyLink(this);
  }

  public toJSON(): Link {
    return {
      __bloxtype: 'Link',
      id: this.id,
      type: this.type,
      driven: this.driven || undefined,
    };
  }

  public copy(): JSLink {
    return new JSLink(this);
  }

  public eq(other: Link): boolean {
    // Type does not have to be equal
    return isLink(other)
      && this.id === other.id
      && !!this.driven === !!other.driven;
  }
}

export function bloxLink(id: string | null, type: BlockOrIntfType | null, driven: boolean): JSLink;
export function bloxLink(id: string | null, type: BlockOrIntfType | null): JSLink;
export function bloxLink(id: string | null): JSLink;
export function bloxLink(raw: Link): JSLink;
export function bloxLink(value: Link | string | null, type?: BlockOrIntfType | null, driven?: boolean): JSLink {
  return new JSLink(value as any, type as any, driven as any);
}
