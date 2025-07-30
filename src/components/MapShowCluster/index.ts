// Re-export both the component and the handle interface so that
// downstream modules can use the ref type without importing the
// heavier MapShowCluster implementation file directly.
import MapShowCluster, { _MapShowClusterHandle } from './MapShowCluster';

export type { _MapShowClusterHandle };
export default MapShowCluster;
