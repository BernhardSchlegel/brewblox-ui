import { matchesType } from '@/helpers/functional';
import { AutomationSpec, TaskStatusImpl } from '@/plugins/automation/types';

import TaskStatus from './TaskStatus.vue';

const type = 'TaskStatus';
const spec: AutomationSpec<TaskStatusImpl> = {
  type,
  title: 'Task status',
  component: TaskStatus,
  generate: () => ({
    type,
    ref: '',
    status: 'Finished',
    resetStatus: null,
  }),
  pretty: impl =>
    matchesType<TaskStatusImpl>(type, impl)
      ? `Task with ref '${impl.ref}' must be ${impl.status}`
      : `Invalid data: type=${impl.type}`,
};

export default spec;
