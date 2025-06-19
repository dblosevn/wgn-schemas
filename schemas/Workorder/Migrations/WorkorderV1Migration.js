export function WorkorderV1Migration(oldDoc) {
  for (let lane of oldDoc.lanes) {
    lane = Object.assign(lane, {
      images: {
        before: false,
        after: false,
      },
      qb: {
        before: {
          value: false,
          state: 0,
        },
        update: {
          value: false,
          state: 0,
        },
        after: {
          value: false,
          state: 0,
        },
      }
    });
  }

  return oldDoc;
}
export default WorkorderV1Migration
