import { generalConfig } from '../../config/generalConfig';
import {
  validateDate,
  validateEmail,
  capitalizeFirstLetter,
  stringToArray,
  verifyCriticalEnvVariable,
  incrementVersionNumber,
  validateURL,
  getCurrentDate,
  randomFloatInRange,
  randomHex,
  randomIntInRange,
  stripIdentifierBaseURL,
  stringToEnumValue,
  formatORCID,
  normaliseHttpProtocol,
  reorderDisplayOrder,
  removeNullAndUndefinedFromJSON,
  normaliseDate,
  normaliseDateTime,
} from '../helpers';

describe('Date validation', () => {
  test('returns true when the value is a date', async () => {
    expect(validateDate('2024-08-14T13:41:12.000Z')).toBe(true);
    expect(validateDate('2024-08-14T13:41:12Z')).toBe(true);
    expect(validateDate('2024-08-14T13:41:12')).toBe(true);
    expect(validateDate('2024-08-14 13:41:12')).toBe(true);
    expect(validateDate('2024-08-14 13:41')).toBe(true);
    expect(validateDate('08/14/2024')).toBe(true);

    const date = new Date();
    expect(validateDate(date.toDateString())).toBe(true);
    expect(validateDate(date.toISOString())).toBe(true);
    expect(validateDate(date.toLocaleDateString())).toBe(true);
    expect(validateDate(date.toLocaleString())).toBe(true);
    expect(validateDate(date.toISOString())).toBe(true);
    expect(validateDate(date.toString())).toBe(true);
  });

  test('returns false when the value is NOT a date', async () => {
    expect(validateDate('2024-AZ-14 13:BY:12')).toBe(false);
    expect(validateDate('425624756')).toBe(false);
    expect(validateDate('abcdef')).toBe(false);
    expect(validateDate('false')).toBe(false);
    expect(validateDate(null)).toBe(false);
    expect(validateDate('{"date": "2024-08-14T13:48:00Z"}')).toBe(false);

    const date = new Date();
    expect(validateDate(date.toTimeString())).toBe(false);
    expect(validateDate(date.toLocaleTimeString())).toBe(false);
  });
});

describe('Email validation', () => {
  test('returns true if the value is a valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('test-user@example.company')).toBe(true);
    expect(validateEmail('test.user@example.co')).toBe(true);
    expect(validateEmail('a@b.ab')).toBe(true);
  });

  test('returns true if the value is NOT an email', () => {
    expect(validateEmail('test.example.com')).toBe(false);
    expect(validateEmail('test-user@example')).toBe(false);
    expect(validateEmail('@example.co')).toBe(false);
  });
});

describe('URL validation', () => {
  test('returns true for valid URLs', () => {
    expect(validateURL('https://www.example.com')).toBe(true);
    expect(validateURL('http://www.example.com')).toBe(true);
    expect(validateURL('file://www.example.com')).toBe(true);
    expect(validateURL('http://example.com')).toBe(true);
    expect(validateURL('https://example.com/path/to/page')).toBe(true);
    expect(validateURL('https://example.com/path/to/page?qs=1&qs2=2')).toBe(true);
  });

  test('returns false for invalid URLs', () => {
    expect(validateURL('www.example/path/to/page')).toBe(false);
    expect(validateURL('example.com')).toBe(false);
    expect(validateURL('example.com/path')).toBe(false);
    expect(validateURL('hehgiehgehgerge')).toBe(false);
    expect(validateURL('58757899')).toBe(false);
  });
});

describe('Strips the protocol and domain from known identifiers', () => {
  test('it handles ORCIDs properly', () => {
    const orcidId = '0000-0000-0000-0000 ';
    expect(stripIdentifierBaseURL(`${generalConfig.orcidBaseURL}${orcidId}`)).toEqual(orcidId.trim());
    expect(stripIdentifierBaseURL(orcidId)).toEqual(orcidId.trim());
  });

  test('it handles RORs properly', () => {
    const rorId = 'a0000z ';
    expect(stripIdentifierBaseURL(`${generalConfig.rorBaseURL}${rorId}`)).toEqual(rorId.trim());
    expect(stripIdentifierBaseURL(rorId)).toEqual(rorId.trim());
  });

  test('it handles DOIs properly', () => {
    const dmpId = `${generalConfig.dmpIdShoulder}B2C3D4 `;
    expect(stripIdentifierBaseURL(`${generalConfig.dmpIdBaseURL}${dmpId}`)).toEqual(dmpId.trim());
    expect(stripIdentifierBaseURL(dmpId)).toEqual(dmpId.trim());
  });

  test('leaves others alone', () => {
    let id = 'http://test.com/0000-0000-0000-0000';
    expect(stripIdentifierBaseURL(id)).toEqual(id);
    id = 'http://orcid.org/0000';
    expect(stripIdentifierBaseURL(id)).toEqual(id);
    id = 'http://ror.org/0000-0000-0000-0000';
    expect(stripIdentifierBaseURL(id)).toEqual(id);
    id = 'http://doi.org/98724896247698457604597645067452706';
    expect(stripIdentifierBaseURL(id)).toEqual(id);
  });
});

describe('Capitalize the first letter of a string', () => {
  test('it works', () => {
    expect(capitalizeFirstLetter('test')).toEqual('Test');
    expect(capitalizeFirstLetter('   teSt  ')).toEqual('TeSt');
    expect(capitalizeFirstLetter(' van gogh')).toEqual('Van gogh');
    expect(capitalizeFirstLetter('van Gogh')).toEqual('Van Gogh');
  });

  test('it can handle an empty string', () => {
    expect(capitalizeFirstLetter('')).toEqual('');
    expect(capitalizeFirstLetter('  ')).toEqual('');
  })
});

describe('Convert a string into an Array', () => {
  test('returns the string as string[]', () => {
    expect(stringToArray('foo bar baz')).toEqual(['foo', 'bar', 'baz']);
  });
  test('returns the default', () => {
    expect(stringToArray(null)).toEqual([]);
  });
  test('allows us to define the delimiter', () => {
    expect(stringToArray('foo, bar , baz', ',')).toEqual(['foo', 'bar', 'baz']);
  });
  test('allows us to define the default response', () => {
    expect(stringToArray(null, ',', ['test'])).toEqual(['test']);
  });
});

describe('removeNullAndUndefinedFromJSON', () => {
  it('removes null and undefined values from objects', () => {
    const input = JSON.stringify({ a: 1, b: null, c: undefined, d: 'test' });
    expect(removeNullAndUndefinedFromJSON(input)).toBe(JSON.stringify({ a: 1, d: 'test' }));
  });

  it('removes null and undefined values from arrays', () => {
    const input = JSON.stringify([1, null, 2, undefined, 3]);
    expect(removeNullAndUndefinedFromJSON(input)).toBe(JSON.stringify([1, 2, 3]));
  });

  it('removes nested null and undefined values', () => {
    const input = JSON.stringify({
      a: null,
      b: [1, null, 2, undefined, 3],
      c: { d: null, e: 5, f: undefined }
    });
    expect(removeNullAndUndefinedFromJSON(input)).toBe(JSON.stringify({
      b: [1, 2, 3],
      c: { e: 5 }
    }));
  });

  it('returns the same JSON if there are no null or undefined values', () => {
    const input = JSON.stringify({ a: 1, b: 2 });
    expect(removeNullAndUndefinedFromJSON(input)).toBe(JSON.stringify({ a: 1, b: 2 }));
  });

  it('throws an error for invalid JSON', () => {
    expect(() => removeNullAndUndefinedFromJSON('{a:1, b:2}')).toThrow(/Invalid JSON format/);
  });

  it('handles stringified arrays with only null/undefined', () => {
    const input = JSON.stringify([null, undefined, null]);
    expect(removeNullAndUndefinedFromJSON(input)).toBe(JSON.stringify([]));
  });

  it('handles stringified objects with only null/undefined', () => {
    const input = JSON.stringify({ a: null, b: undefined });
    expect(removeNullAndUndefinedFromJSON(input)).toBe(JSON.stringify({}));
  });

  it('handles primitive values', () => {
    expect(removeNullAndUndefinedFromJSON('1')).toBe('1');
    expect(removeNullAndUndefinedFromJSON('"test"')).toBe('"test"');
    expect(removeNullAndUndefinedFromJSON('true')).toBe('true');
  });
});

describe('Verify critical env variables', () => {
  test('does not log an error if the specified variable exist', () => {
    const logSpy = jest.spyOn(global.console, 'log').mockImplementation(() => { return null });
    verifyCriticalEnvVariable('NODE_ENV');
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
  test('logs an error if the specified variable does not exist', () => {
    const logSpy = jest.spyOn(global.console, 'log').mockImplementation(() => { return null });
    verifyCriticalEnvVariable('TEST_SECRET');
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

describe('Version number incrementer', () => {
  test('returns the version as-is if it does not have a numeric part', () => {
    let newVersion = incrementVersionNumber('');
    expect(newVersion).toEqual('');
    newVersion = incrementVersionNumber('v');
    expect(newVersion).toEqual('v');
  });

  test('can increment a major only version number', () => {
    let newVersion = incrementVersionNumber('v1');
    expect(newVersion).toEqual('v2');
    newVersion = incrementVersionNumber('v12');
    expect(newVersion).toEqual('v13');
    newVersion = incrementVersionNumber('v12345');
    expect(newVersion).toEqual('v12346');
  });
});

describe('getCurrentDate', () => {
  it('returns a date (as string) in the expected format', () => {
    const result = getCurrentDate();
    expect(/[0-9]{4}-[0-9]{2}-[0-9]{2}\s([0-9]{2}:){2}[0-9]{2}/.test(result)).toBe(true);
  });
});

describe('randomFloatInRange', () => {
  it('returns a random floating point number within the specified range', () => {
    const min = 1.2;
    const max = 10.6;
    const result = randomFloatInRange(min, max);
    expect(result >= min && result <= max).toBe(true);
  });
});

describe('randomIntInRange', () => {
  it('returns a random integer within the specified range', () => {
    const min = 1;
    const max = 10;
    const result = randomIntInRange(min, max);
    expect(result >= min && result <= max).toBe(true);
  });
});

describe('randomHex', () => {
  it('returns a string in the expected format', () => {
    const val = randomHex(32);
    expect(/[a-z0-9]{32}/.test(val)).toBe(true);
  });
});

describe('stringToEnumValue', () => {
  enum testEnum {
    A = "A",
    B = "B"
  }

  it('returns null if the string is not one of the items in the enum', () => {
    expect(stringToEnumValue(testEnum, 'C')).toBe(null);
  });

  it('returns the enum value for the string', () => {
    expect(stringToEnumValue(testEnum, 'B')).toBe(testEnum.B);
  });
});


describe('formatORCID', () => {
  // Test the ORCID formatting
  it('should return null for an invalid ORCID', () => {
    expect(formatORCID('25t24g45g45g546gt')).toBeNull();
    expect(formatORCID('0000-0000-0000')).toBeNull();
    expect(formatORCID(`${generalConfig.orcidBaseURL}/0000-0000-000`)).toBeNull();
  });

  it('should return the ORCID with the default URL', () => {
    expect(formatORCID('0000-0000-0000-000X')).toEqual(normaliseHttpProtocol(`${generalConfig.orcidBaseURL}0000-0000-0000-000X`));
  });

  it('should return the ORCID as is if it already a valid ORCID with the base URL', () => {
    expect(formatORCID(`${generalConfig.orcidBaseURL}0000-0000-0000-000X`)).toEqual(normaliseHttpProtocol(`${generalConfig.orcidBaseURL}0000-0000-0000-000X`));
    expect(formatORCID('https://sandbox.orcid.org/0000-0000-0000-000X')).toEqual('https://sandbox.orcid.org/0000-0000-0000-000X');
  });

  it('should convert http to https for valid ORCID URLs', () => {
    expect(formatORCID(`http://orcid.org/0000-0000-0000-000X`)).toEqual(`https://orcid.org/0000-0000-0000-000X`);
    expect(formatORCID('http://sandbox.orcid.org/0000-0000-0000-000X')).toEqual('https://sandbox.orcid.org/0000-0000-0000-000X');
  });
});

describe('normaliseDateTime', () => {
  it('should handle a null value', () => {
    expect(normaliseDateTime(null)).toEqual(null);
  });

  it('should handle an undefined value', () => {
    expect(normaliseDateTime(undefined)).toEqual(null);
  });

  it('should handle an invalid date', () => {
    expect(normaliseDateTime('2021-AB-01')).toEqual(null);
  });

  it('should format the date as expected', () => {
    expect(normaliseDateTime('01/01/2021')).toEqual('2021-01-01 00:00:00');
  });

  it('should format the date as expected', () => {
    expect(normaliseDateTime('2021-01-01 00:00:00')).toEqual('2021-01-01 00:00:00');
  });
});

describe('normaliseDate', () => {
  it('should handle a null value', () => {
    expect(normaliseDate(null)).toEqual(null);
  });

  it('should handle an undefined value', () => {
    expect(normaliseDate(undefined)).toEqual(null);
  });

  it('should handle string that is not a valid date', () => {
    expect(normaliseDate('2021-01-AB')).toEqual(null);
  });

  it('should handle a string value', () => {
    expect(normaliseDate('2021-01-01')).toEqual('2021-01-01');
  });
});

describe('reorderDisplayOrder', () => {
  it('should reorder the display order of sections', () => {
    const sections = [
      { id: 1, displayOrder: 1 },
      { id: 2, displayOrder: 2 },
      { id: 3, displayOrder: 3 },
    ];

    const reorderedSections = reorderDisplayOrder(2, 1, sections);
    expect(reorderedSections[0].displayOrder).toBe(1);
    expect(reorderedSections[1].displayOrder).toBe(2);
    expect(reorderedSections[2].displayOrder).toBe(3);
  });

  it('should handle the case where the new display order is the same as the current one', () => {
    const sections = [
      { id: 1, displayOrder: 1 },
      { id: 2, displayOrder: 2 },
      { id: 3, displayOrder: 3 },
    ];

    const reorderedSections = reorderDisplayOrder(2, 2, sections);
    expect(reorderedSections[0].displayOrder).toBe(1);
    expect(reorderedSections[1].displayOrder).toBe(2);
    expect(reorderedSections[2].displayOrder).toBe(3);
  });

  it('should handle the case where the new display order is greater than the current one', () => {
    const sections = [
      { id: 1, displayOrder: 1 },
      { id: 2, displayOrder: 2 },
      { id: 3, displayOrder: 3 },
    ];

    const reorderedSections = reorderDisplayOrder(1, 3, sections);
    expect(reorderedSections[0].displayOrder).toBe(1);
    expect(reorderedSections[1].displayOrder).toBe(2);
    expect(reorderedSections[2].displayOrder).toBe(3);
  });

  it('should handle the case where the new display order is less than the current one', () => {
    const sections = [
      { id: 1, displayOrder: 1 },
      { id: 2, displayOrder: 2 },
      { id: 3, displayOrder: 3 },
    ];

    const reorderedSections = reorderDisplayOrder(3, 1, sections);
    expect(reorderedSections[0].displayOrder).toBe(1);
    expect(reorderedSections[1].displayOrder).toBe(2);
    expect(reorderedSections[2].displayOrder).toBe(3);
  });

  it('should handle the case where the list is empty', () => {
    const sections: { id: number, displayOrder: number }[] = [];
    const reorderedSections = reorderDisplayOrder(1, 1, sections);
    expect(reorderedSections).toEqual([]);
  });

  it('should handle the case where the list has only one item', () => {
    const sections = [{ id: 1, displayOrder: 1 }];
    const reorderedSections = reorderDisplayOrder(1, 1, sections);
    expect(reorderedSections).toEqual(sections);
  });

  it('should handle the case where the object being moved is not in the list', () => {
    const sections = [
      { id: 1, displayOrder: 1 },
      { id: 2, displayOrder: 2 },
      { id: 3, displayOrder: 3 },
    ];

    const reorderedSections = reorderDisplayOrder(4, 1, sections);
    expect(reorderedSections).toEqual(sections);
  });

  it('should handle the case where the new display order is out of bounds', () => {
    const sections = [
      { id: 1, displayOrder: 1 },
      { id: 2, displayOrder: 2 },
      { id: 3, displayOrder: 3 },
    ];

    const reorderedSections = reorderDisplayOrder(2, 5, sections);
    expect(reorderedSections[0].displayOrder).toBe(1);
    expect(reorderedSections[1].displayOrder).toBe(2);
    expect(reorderedSections[2].displayOrder).toBe(3);
  });

  it('should handle the case where the new display order is negative', () => {
    const sections = [
      { id: 1, displayOrder: 1 },
      { id: 2, displayOrder: 2 },
      { id: 3, displayOrder: 3 },
    ];

    const reorderedSections = reorderDisplayOrder(2, -1, sections);
    expect(reorderedSections[0].displayOrder).toBe(1);
    expect(reorderedSections[1].displayOrder).toBe(2);
    expect(reorderedSections[2].displayOrder).toBe(3);
  });

  it('should handle the case where the new display order is zero', () => {
    const sections = [
      { id: 1, displayOrder: 1 },
      { id: 2, displayOrder: 2 },
      { id: 3, displayOrder: 3 },
    ];

    const reorderedSections = reorderDisplayOrder(2, 0, sections);
    expect(reorderedSections[0].displayOrder).toBe(1);
    expect(reorderedSections[1].displayOrder).toBe(2);
    expect(reorderedSections[2].displayOrder).toBe(3);
  });

  it('should handle the case where the new display order is the same as the last one', () => {
    const sections = [
      { id: 1, displayOrder: 1 },
      { id: 2, displayOrder: 2 },
      { id: 3, displayOrder: 3 },
    ];

    const reorderedSections = reorderDisplayOrder(2, 3, sections);
    expect(reorderedSections[0].displayOrder).toBe(1);
    expect(reorderedSections[1].displayOrder).toBe(2);
    expect(reorderedSections[2].displayOrder).toBe(3);
  });
});
