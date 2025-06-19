export function WorkorderV5Migration(oldDoc) {
  return {
    ...oldDoc,
    invoiceID: null, // Add new top-level field
    meta: {}, // Add top-level meta field
    lanes: Array.isArray(oldDoc.lanes)
      ? oldDoc.lanes.map(lane => ({
          ...lane,
          meta: {}, // Add meta field to each lane
          order: {
            ...lane.order,
            vga: false // Add new field with default
          }
        }))
      : [],
    rawLanes: Array.isArray(oldDoc.rawLanes)
      ? oldDoc.rawLanes.map(lane => ({
          ...lane,
          meta: {}, // Add meta field to each raw lane
          order: {
            ...lane.order,
            vga: false // Add new field with default
          }
        }))
      : []
  };
}
export default WorkorderV5Migration;
