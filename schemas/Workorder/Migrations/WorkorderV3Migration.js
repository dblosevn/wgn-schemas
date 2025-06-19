export function WorkorderV3Migration(oldDoc) {
  for (let laneIndex in oldDoc.lanes) {
    let lane = oldDoc.lanes[laneIndex]
    oldDoc.lanes[laneIndex] = Object.assign(
      {
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
        },
        order: {
          patchCable: false,
          keyboard: false,
          pinPad: false,
          pinPadCable: false,
          scanner: false,
          scannerCable: false,
          cashDrawer: false,
          cashDrawerCable: false,
          printer: false,
          printerCable: false,
        },
      },
      lane,
    )
  }
  delete oldDoc.order
  return oldDoc
}
export default WorkorderV3Migration
