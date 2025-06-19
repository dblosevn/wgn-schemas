// AUTO-GENERATED FILE. DO NOT EDIT.

/** @typedef {Object} AssignmentDoc

 * @property {string} id

 * @property {string} clientID

 * @property {object | any} paid_on

 * @property {object} scheduled_date

 * @property {string} title_short

 * @property {string} location_name

 * @property {string} price

 * @property {string} city

 * @property {string} state

 * @property {string} status

 * @property {boolean} is_fast_funded

 * @property {object} resource

 * @property {object} details

 * @property {string | any} invoiceID

 * @property {string | any} techInvoiceID

 */

export const AssignmentDoc = {};

/** @typedef {import('rxdb').RxCollection<AssignmentDoc>} AssignmentCollection */

export const AssignmentCollection = {};


/** @typedef {Object} CacheDoc

 * @property {string} guid

 * @property {string} url

 * @property {boolean} chunked

 * @property {number} timestamp

 * @property {number} completed

 * @property {number} uploaded

 * @property {object} body

 * @property {object} files

 * @property {object} headers

 * @property {any} status

 */

export const CacheDoc = {};

/** @typedef {import('rxdb').RxCollection<CacheDoc>} CacheCollection */

export const CacheCollection = {};


/** @typedef {Object} InvoiceDoc

 * @property {string} id

 * @property {string} customer

 * @property {string} date

 * @property {string} dueDate

 * @property {string} clientID

 * @property {number} gross

 * @property {number} fees

 * @property {number} total

 * @property {any[]} lines

 */

export const InvoiceDoc = {};

/** @typedef {import('rxdb').RxCollection<InvoiceDoc>} InvoiceCollection */

export const InvoiceCollection = {};


/** @typedef {Object} PaymentDoc

 * @property {string} id

 * @property {object | any} date

 * @property {boolean} completed

 * @property {string} clientID

 * @property {string | any} work_number

 * @property {string} type

 * @property {string} description

 * @property {number} amount

 * @property {any[]} aaData

 * @property {object} details

 */

export const PaymentDoc = {};

/** @typedef {import('rxdb').RxCollection<PaymentDoc>} PaymentCollection */

export const PaymentCollection = {};


/** @typedef {Object} SignatureDoc

 * @property {string} id

 * @property {string} vkey

 * @property {string} username

 * @property {number} width

 * @property {number} height

 * @property {any} trimmed

 * @property {string} original

 */

export const SignatureDoc = {};

/** @typedef {import('rxdb').RxCollection<SignatureDoc>} SignatureCollection */

export const SignatureCollection = {};


/** @typedef {Object} TechinvoiceDoc

 * @property {string} id

 * @property {string} username

 * @property {number} date

 * @property {boolean} isTechZone

 * @property {any[]} assignments

 * @property {number} total

 */

export const TechinvoiceDoc = {};

/** @typedef {import('rxdb').RxCollection<TechinvoiceDoc>} TechinvoiceCollection */

export const TechinvoiceCollection = {};


/** @typedef {Object} UserDoc

 * @property {string} username

 * @property {string} email

 * @property {string} name

 * @property {string} password

 * @property {string} token

 * @property {any[]} alternateEmail

 */

export const UserDoc = {};

/** @typedef {import('rxdb').RxCollection<UserDoc>} UserCollection */

export const UserCollection = {};


/** @typedef {Object} WorkorderDoc

 * @property {string} id

 * @property {string} vkey

 * @property {string} username

 * @property {string | any} invoiceID

 * @property {number} storeNum

 * @property {number} visit

 * @property {string} date

 * @property {string} qbUpdateUrl

 * @property {object} meta

 * @property {any} lanes

 * @property {any} rawLanes

 * @property {any} as400

 * @property {string} tech

 * @property {string} time

 * @property {string} endTime

 * @property {number} hours

 * @property {number} drive

 * @property {string} tech2

 * @property {string} time2

 * @property {string} endTime2

 * @property {number} hours2

 * @property {number} drive2

 * @property {string} tracking

 * @property {any} delays

 * @property {string} pocName

 * @property {string} pocTitle

 * @property {string} address

 * @property {any} qb

 * @property {any} counts

 * @property {any} links

 * @property {string} notes

 * @property {object} storeHours

 * @property {any} expenses

 * @property {string} sig

 */

export const WorkorderDoc = {};

/** @typedef {import('rxdb').RxCollection<WorkorderDoc>} WorkorderCollection */

export const WorkorderCollection = {};


/**
 * @typedef {Object} WMCollections
 * @property {AssignmentCollection} Assignments
 * @property {InvoiceCollection} Invoices
 * @property {PaymentCollection} Payments
 * @property {TechinvoiceCollection} Techinvoices
 * @property {import('rxdb').RxDatabase} db
 */
export const WMCollections = {};

/**
 * @typedef {Object} WGNCollections
 * @property {CacheCollection} Caches
 * @property {SignatureCollection} Signatures
 * @property {UserCollection} Users
 * @property {WorkorderCollection} Workorders
 * @property {import('rxdb').RxDatabase} db
 */
export const WGNCollections = {};

/**
 * @typedef {Object} AllCollections
 * @property {AssignmentCollection} Assignments
 * @property {InvoiceCollection} Invoices
 * @property {PaymentCollection} Payments
 * @property {TechinvoiceCollection} Techinvoices
 * @property {CacheCollection} Caches
 * @property {SignatureCollection} Signatures
 * @property {UserCollection} Users
 * @property {WorkorderCollection} Workorders
 * @property {import('rxdb').RxDatabase} db
 */
export const AllCollections = {};
