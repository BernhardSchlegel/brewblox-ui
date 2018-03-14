import Vue from 'vue';
import Component from 'vue-class-component';

import Plotly from './plotly.vue';

import { getById } from '../../store/blocks/OneWireTempSensor/getters';
import { findBlockWithMetrics } from '../../store/blocks/actions';

@Component({
  props: {
    id: {
      default: '',
      type: String,
    },
  },
  components: {
    Plotly,
  },
})
export default class Metrics extends Vue {
  plotly = {
    data: [
      {
        type: 'scatter',
        mode: 'lines+points',
        x: [1, 2, 3],
        y: [2, 6, 3],
        marker: { color: 'red' },
      },
      {
        type: 'bar',
        x: [1, 2, 3],
        y: [2, 5, 3],
      },
    ],
    layout: {
      title: 'A Fancy Plot',
    },
  };

  get blockData() {
    return getById(this.$props.id);
  }

  get metrics() {
    return this.blockData.metrics;
  }

  get loading() {
    return this.blockData.isLoading;
  }

  created() {
    if (this.metrics.length === 0) {
      findBlockWithMetrics(this.$props.id);
    }
  }
}
