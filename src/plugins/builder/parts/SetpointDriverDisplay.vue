<script lang="ts">
import {
  mdiBullseyeArrow,
  mdiGauge,
  mdiPlusMinus,
  mdiThermometer,
} from '@quasar/extras/mdi-v5';
import { Component } from 'vue-property-decorator';

import { bloxQty, isQuantity, Quantity } from '@/helpers/bloxfield';
import { serviceTemp } from '@/plugins/spark/helpers';
import { sparkStore } from '@/plugins/spark/store';
import {
  ActuatorOffsetBlock,
  ActuatorPwmBlock,
  BlockAddress,
  ReferenceKind,
  SetpointSensorPairBlock,
} from '@/plugins/spark/types';

import PartBase from '../components/PartBase';
import { settingsAddress } from '../helpers';


@Component
export default class SetpointDriverDisplay extends PartBase {
  icons: Mapped<string> = {};
  readonly settingsKey = 'setpointDriver';
  readonly scaleKey = 'scale';

  created(): void {
    this.icons.mdiPlusMinus = mdiPlusMinus;
    this.icons.mdiBullseyeArrow = mdiBullseyeArrow;
    this.icons.mdiThermometer = mdiThermometer;
    this.icons.mdiGauge = mdiGauge;
  }

  get scale(): number {
    return this.settings[this.scaleKey] ?? 1;
  }

  get address(): BlockAddress {
    return settingsAddress(this.part, this.settingsKey);
  }

  get block(): ActuatorOffsetBlock | null {
    const { serviceId, id } = this.address;
    return sparkStore.blockById(serviceId, id);
  }

  get isBroken(): boolean {
    return this.block === null
      && this.address.id !== null;
  }

  // Reference actually is a BlockIntf.ProcessValueInterface
  // We don't have a TS type for that, but Setpoint/PWM are a good intersection
  get refBlock(): SetpointSensorPairBlock | ActuatorPwmBlock | null {
    if (!this.block) {
      return null;
    }
    return sparkStore.blockById(
      this.block.serviceId,
      this.block.data.referenceId.id);
  }

  get refAmount(): Quantity | number | null {
    if (!this.block || !this.refBlock) {
      return null;
    }
    return this.block.data.referenceSettingOrValue === ReferenceKind.REF_SETTING
      ? this.refBlock.data.setting
      : this.refBlock.data.value;
  }

  get refIcon(): string {
    if (!this.block || !this.refBlock) {
      return '';
    }
    if (this.block.data.referenceSettingOrValue === ReferenceKind.REF_SETTING) {
      return 'mdiBullseyeArrow';
    }
    return isQuantity(this.refAmount)
      ? 'mdiThermometer'
      : 'mdiGauge';
  }

  get tempUnit(): 'delta_degC' | 'delta_degF' {
    return this.block !== null
      && serviceTemp(this.block.serviceId) === 'degF'
      ? 'delta_degF'
      : 'delta_degC';
  }

  get actualSetting(): Quantity | number | null {
    const v = this.block?.data.setting ?? null;
    return isQuantity(this.refAmount)
      ? bloxQty(v, 'delta_degC').to(this.tempUnit)
      : v;
  }
}
</script>

<template>
  <g :transform="`scale(${scale} ${scale})`">
    <SvgEmbedded
      :width="squares(2)"
      :height="squares(1)"
    >
      <BrokenIcon v-if="isBroken" class="col" />
      <UnlinkedIcon v-else-if="!block" class="col" />
      <div v-else class="col column q-ma-xs">
        <div class="col row q-gutter-x-xs">
          <q-icon
            :name="icons[refIcon]"
            size="20px"
            class="static col-auto"
          />
          <q-space />
          <div class="col-auto text-bold">
            {{ refAmount | quantity }}
          </div>
        </div>
        <div class="col row q-gutter-x-xs">
          <q-icon
            :name="icons.mdiPlusMinus"
            size="20px"
            class="static col-auto"
          />
          <q-space />
          <div class="col-auto text-bold">
            {{ actualSetting | quantity }}
          </div>
        </div>
      </div>
    </SvgEmbedded>
    <g class="outline">
      <rect
        v-show="bordered"
        :width="squares(2)-2"
        :height="squares(1)-2"
        x="1"
        y="1"
        rx="6"
        ry="6"
        stroke-width="2px"
      />
    </g>
  </g>
</template>
