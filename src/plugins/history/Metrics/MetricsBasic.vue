<script lang="ts">
import parseDuration from 'parse-duration';
import { uid } from 'quasar';
import { Component, Prop, Watch } from 'vue-property-decorator';

import CrudComponent from '@/components/CrudComponent';
import { durationString } from '@/helpers/duration';
import { addSource } from '@/plugins/history/sources/metrics';
import { historyStore } from '@/plugins/history/store';
import { DisplayNames, MetricsResult, MetricsSource, QueryParams, QueryTarget } from '@/plugins/history/types';

import { DEFAULT_DECIMALS, DEFAULT_FRESH_DURATION } from './getters';
import { MetricsConfig } from './types';

interface CurrentValue extends MetricsResult {
  name: string;
  stale: boolean;
}

@Component
export default class MetricsBasic extends CrudComponent<MetricsConfig> {
  parseDuration = parseDuration;
  durationString = durationString;
  DEFAULT_FRESH_DURATION = DEFAULT_FRESH_DURATION;
  metricsId: string | null = null;

  @Prop({ type: Number, required: true })
  public readonly revision!: number;

  @Watch('widgetCfg', { immediate: true, deep: true })
  updateWatcher(newVal: MetricsConfig, oldVal: MetricsConfig): void {
    if (newVal && JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      this.resetSources();
    }
  }

  @Watch('revision')
  triggerUpdate(): void {
    this.resetSources();
  }

  destroyed(): void {
    this.removeSources();
  }

  get widgetCfg(): MetricsConfig {
    return {
      targets: [],
      renames: {},
      params: {},
      freshDuration: {},
      decimals: {},
      ...this.widget.config as Partial<MetricsConfig>,
    };
  }

  get targets(): QueryTarget[] {
    return this.widgetCfg.targets;
  }

  get renames(): DisplayNames {
    return this.widgetCfg.renames;
  }

  get params(): QueryParams {
    return this.widgetCfg.params;
  }

  get sources(): MetricsSource[] {
    return this.targets
      .map(target => historyStore.sourceById(this.sourceId(target)))
      .filter((source): source is MetricsSource => source != null);
  }

  fieldFreshDuration(field: string): number {
    return this.widgetCfg.freshDuration[field] ?? DEFAULT_FRESH_DURATION;
  }

  fieldDecimals(field: string): number {
    return this.widgetCfg.decimals[field] ?? DEFAULT_DECIMALS;
  }

  get values(): CurrentValue[] {
    const now = new Date().getTime();
    return this.sources
      .flatMap(source => source.values)
      .map(result => ({
        ...result,
        name: this.renames[result.field] || result.field,
        stale: !!result.time && (now - result.time as number > this.fieldFreshDuration(result.field)),
      }));
  }

  sourceId(target: QueryTarget): string {
    if (this.metricsId === null) {
      this.metricsId = uid();
    }
    return `${this.metricsId}/${target.measurement}`;
  }

  addSources(): void {
    this.targets
      .forEach(target =>
        addSource(
          this.sourceId(target),
          this.params,
          this.renames,
          target,
        ));
  }

  removeSources(): void {
    this.sources.forEach(historyStore.removeSource);
  }

  resetSources(): void {
    this.removeSources();
    this.addSources();
  }
}
</script>

<template>
  <div class="widget-md">
    <div v-if="targets.length === 0">
      <div class="text-italic text-h6 q-pa-md darkened text-center">
        Add metrics to get started.
      </div>
    </div>
    <CardWarning v-else-if="values.length === 0">
      <template #message>
        Waiting for data...
      </template>
    </CardWarning>

    <div class="widget-body column">
      <LabeledField
        v-for="val in values"
        :key="val.field"
        :label="val.name"
      >
        <big :class="{darkened: val.stale}">
          {{ val.value | round(fieldDecimals(val.field)) }}
        </big>
        <template v-if="val.stale" #after>
          <q-icon name="warning" size="24px" />
          <q-tooltip>
            {{ val.name }} was updated more than {{ durationString(fieldFreshDuration(val.field)) }} ago.
            <br>
            Last update: {{ new Date(val.time).toLocaleString() }}.
          </q-tooltip>
        </template>
      </LabeledField>
    </div>
    <div
      v-if="values.length === 0"
      class="column q-px-md"
    >
      <q-btn
        flat
        dense
        color="secondary"
        icon="edit"
        label="Edit metrics"
        class="self-end"
        @click="$emit('mode', 'Full')"
      />
    </div>
  </div>
</template>
