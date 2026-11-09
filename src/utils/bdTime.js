// Canonical source, copied to each independently deployed frontend's utils/bdTime.js.
// See tools/check-bangladesh-time.cjs for consistency and cross-timezone tests.
export const BUSINESS_TIME_ZONE = 'Asia/Dhaka';
const OFFSET_MS = 6 * 60 * 60 * 1000;

/**
 * A scoped Date for Bangladesh business screens. The stored instant, JSON and
 * toISOString() remain UTC; local calendar methods and display use Dhaka.
 * No browser globals are modified. Explicit UTC methods retain native behavior.
 */
export class BDDate extends Date {
  constructor(...args) {
    if (args.length > 1) {
      super(Date.UTC(...args) - OFFSET_MS);
    } else if (args.length === 0) {
      super();
    } else {
      let value = args[0];
      if (typeof value === 'string') {
        value = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) value += 'T00:00:00+06:00';
        else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)) value += '+06:00';
      }
      super(value);
    }
  }

  _wall() { return new Date(this.getTime() + OFFSET_MS); }
  _set(method, args) {
    const wall = this._wall();
    wall[method](...args);
    return this.setTime(wall.getTime() - OFFSET_MS);
  }

  getFullYear() { return this._wall().getUTCFullYear(); }
  getMonth() { return this._wall().getUTCMonth(); }
  getDate() { return this._wall().getUTCDate(); }
  getDay() { return this._wall().getUTCDay(); }
  getHours() { return this._wall().getUTCHours(); }
  getMinutes() { return this._wall().getUTCMinutes(); }
  getSeconds() { return this._wall().getUTCSeconds(); }
  getMilliseconds() { return this._wall().getUTCMilliseconds(); }
  getTimezoneOffset() { return Number.isNaN(this.getTime()) ? NaN : -360; }
  setFullYear(...args) { return this._set('setUTCFullYear', args); }
  setMonth(...args) { return this._set('setUTCMonth', args); }
  setDate(...args) { return this._set('setUTCDate', args); }
  setHours(...args) { return this._set('setUTCHours', args); }
  setMinutes(...args) { return this._set('setUTCMinutes', args); }
  setSeconds(...args) { return this._set('setUTCSeconds', args); }
  setMilliseconds(...args) { return this._set('setUTCMilliseconds', args); }

  toLocaleString(locales, options) {
    return super.toLocaleString(locales, { ...options, timeZone: BUSINESS_TIME_ZONE });
  }
  toLocaleDateString(locales, options) {
    return super.toLocaleDateString(locales, { ...options, timeZone: BUSINESS_TIME_ZONE });
  }
  toLocaleTimeString(locales, options) {
    return super.toLocaleTimeString(locales, { ...options, timeZone: BUSINESS_TIME_ZONE });
  }
  toDateString() {
    return Number.isNaN(this.getTime()) ? 'Invalid Date' : this.toLocaleDateString('en-GB');
  }

  /** Wall time for date/month/datetime-local form values, never API storage. */
  toDhakaISOString() {
    return `${this._wall().toISOString().slice(0, -1)}+06:00`;
  }
}
