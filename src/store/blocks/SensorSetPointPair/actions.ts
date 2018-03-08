import store from '../../';

import { commitAddBlock } from '../mutations';
import { SensorSetPointPair } from './SensorSetPointPair';

export const addSensorSetPointPair = ({ id, links }: SensorSetPointPair) => {
  commitAddBlock(store, { id, links, type: 'SensorSetPointPair' });
};