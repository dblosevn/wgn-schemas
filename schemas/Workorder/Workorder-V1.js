export default {
  title: "Workorder Schema",
  version: 1,
  description: "describes a workorder",
  primaryKey: {
    key: "id",
    fields: ["username", "vkey"],
    separator: "|"
  },
  type: "object",
  properties: {
    id: {
        type: "string",
        maxLength: 200
    },
    vkey: {
      type: "string",
      maxLength: 100,
    },
    username: {
      type: "string",
      maxLength: 100,
      ref: "users",
    },
    storeNum: { type: "number" },
    visit: { type: "number" },
    date: { type: "string" },
    qbUpdateUrl: { type: "string" },
    lanes: [{
      type: "object",
      properties: {
        store: { type: "string" },
        type: { type: "string" },
        lane: { type: "number" },
        mac: { type: "string" },
        last4: { type: "string" },
        base: { type: "boolean" },
        printer: { type: "boolean" },
        elo: { type: "boolean" },
        serial: { type: "string" },
        printerSerial: { type: "string" },
        eloSerial: { type: "string" },
        images: {
          type: "object",
          properties: {
            before: {type: "boolean"},
            after: {type: "boolean"},
          }
        },
        qb: {
          type: "object",
          properties: {
            before: {
              type: "object",
              properties: {
                value: {type: "boolean"},
                state: {type: "number"},
              }
            },
            update: {
              type: "object",
              properties: {
                value: {type: "boolean"},
                state: {type: "number"},
              }
            },
            after: {
              type: "object",
              properties: {
                value: {type: "boolean"},
                state: {type: "number"},
              }
            }
          }
        }
      },
    }],
    rawLanes: [{
      type: "object",
      properties: {
        store: { type: "string" },
        type: { type: "string" },
        lane: { type: "number" },
        mac: { type: "string" },
        last4: { type: "string" },
        base: { type: "boolean" },
        printer: { type: "boolean" },
        elo: { type: "boolean" },
        serial: { type: "string" },
        printerSerial: { type: "string" },
        eloSerial: { type: "string" },
        images: {
          type: "object",
          properties: {
            before: {type: "boolean"},
            after: {type: "boolean"},
          }
        },
        qb: {
          type: "object",
          properties: {
            before: {
              type: "object",
              properties: {
                value: {type: "boolean"},
                state: {type: "number"},
              }
            },
            update: {
              type: "object",
              properties: {
                value: {type: "boolean"},
                state: {type: "number"},
              }
            },
            after: {
              type: "object",
              properties: {
                value: {type: "boolean"},
                state: {type: "number"},
              }
            }
          }
        }
      },
    }],
    as400: {
      value: { type: "boolean"},
      serial: { type: "string" },
      tracking: { type: "string" },
      peripherals: { type: "string" },
      peripheralTracking: { type: "string" },
    },
    tech: { type: "string" },
    time: { type: "string" },
    endTime: { type: "string" },
    hours: { type: "number" },
    drive: { type: "number" },
    tech2: { type: "string" },
    time2: { type: "string" },
    endTime2: { type: "string" },
    hours2: { type: "number" },
    drive2: { type: "number" },
    tracking: { type: "string" },
    delays: [
      {
        details: { type: "string" },
        hours: { type: "string" },
        ticket: { type: "string" },
      },
    ],
    pocName: { type: "string" },
    pocTitle: { type: "string" },
    address: { type: "string" },
    qb: {
      url: { type: "string" },
      params: {
        a: { type: "string" },
        ifv: { type: "string" },
        _fid_12: { type: "string" },
        _fid_7: { type: "string" },
        _fid_207: { type: "string" },
        _fid_46: { type: "string" },
        _fid_8: { type: "string" },
        _fid_9: { type: "string" },
        _fid_10: { type: "string" },
        _fid_48: { type: "string" },
        _fid_49: { type: "string" },
        _fid_50: { type: "string" },
        _fid_512: { type: "string" },
        _fid_52: { type: "string" },
        _fid_513: { type: "string" },
      },
      techParams: {
        _fid_48: { type: "string" },
        _fid_49: { type: "string" },
        _fid_50: { type: "string" },
      },
    },
    counts: {
      base: { type: "number" },
      printer: { type: "number" },
      elo: { type: "number" },
      rawBase: { type: "number" },
      rawPrinter: { type: "number" },
      rawElo: { type: "number" },
    },
    links: {
      "En Route": { type: "string" },
      "Check In": { type: "string" },
      "Submit Before Photo": { type: "string" },
      "Start POS Register Upgrade": { type: "string" },
      "Submit After Photo": { type: "string" },
      "Project Check Out": { type: "string" },
    },
    notes: { type: "string" },
    order: {
      patchCable: {type: "boolean"},
      keyboard: {type: "boolean"},
      pinPad: {type: "boolean"},
      pinPadCable: {type: "boolean"},
      scanner: {type: "boolean"},
      scannerCable: {type: "boolean"},
      cashDrawer: {type: "boolean"},
      cashDrawerCable: {type: "boolean"},
      printer: {type: "boolean"},
      printerCable: {type: "boolean"},
    },
    storeHours: {
      type: "object",
    },
    expenses: {
      value: { type: "boolean"},
      cost: { type: "number" },
      description: { type: "string" },
    },
    sig: {
      type: "string",
      maxLength: 100,
      ref: "signatures",
    }
  },
  required: ["username", "storeNum", "visit", "vkey"],
};
