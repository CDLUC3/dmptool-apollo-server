import casual from 'casual';
import { Affiliation, AffiliationSearch } from '../models/Affiliation.js';

const names = [casual.title, casual.title, casual.title, casual.title, casual.title]
const urls = [casual.url, casual.url, casual.url, casual.url, casual.url]

export const mockRor = () => {
  return `https://ror.org/${casual.integer(1, 99999)}`
}

// The true resolver for affiliations has already been implemented. This is left here as an
// example of how to constuct a mock.
export const data = [
  {
    provenance: "ROR",
    provenanceSyncDate: new Date(casual.date('YYYY-MM-DD')).toISOString(),
    name: names[0],
    displayName: `${names[0]} ${urls[0]}`,
    active: true,
    funder: true,
    fundref: `http://dx.doi.org/10.${casual.integer(1, 99999)}/${casual.integer(1, 999999)}`,
    types: casual.array_of_words(1),
    acronyms: casual.array_of_words(1),
    aliases: casual.array_of_words(2),
    countryCode: casual.country_code,
    countryName: casual.country,
    domain: urls[0],
  },
  {
    provenance: "ROR",
    provenanceSyncDate: new Date(casual.date('YYYY-MM-DD')).toISOString(),
    name: names[1],
    displayName: `${names[1]} ${urls[1]}`,
    active: true,
    funder: false,
    types: casual.array_of_words(1),
    acronyms: [],
    aliases: casual.array_of_words(1),
    countryCode: casual.country_code,
    countryName: casual.country,
    domain: urls[1],
  },
  {
    provenance: "ROR",
    provenanceSyncDate: new Date(casual.date('YYYY-MM-DD')).toISOString(),
    name: names[2],
    displayName: `${names[2]} ${urls[2]}`,
    active: true,
    funder: true,
    fundref: `http://dx.doi.org/10.${casual.integer(1, 99999)}/${casual.integer(1, 999999)}`,
    types: casual.array_of_words(1),
    acronyms: [],
    aliases: [],
    countryCode: casual.country_code,
    countryName: casual.country,
    domain: urls[2],
  },
  {
    provenance: "ROR",
    provenanceSyncDate: new Date(casual.date('YYYY-MM-DD')).toISOString(),
    name: names[3],
    displayName: `${names[3]} ${urls[3]}`,
    active: true,
    funder: true,
    fundref: `http://dx.doi.org/10.${casual.integer(1, 99999)}/${casual.integer(1, 999999)}`,
    types: casual.array_of_words(2),
    acronyms: casual.array_of_words(2),
    aliases: casual.array_of_words(4),
    countryCode: casual.country_code,
    countryName: casual.country,
    domain: urls[3],
  },
  {
    provenance: "ROR",
    provenanceSyncDate: new Date(casual.date('YYYY-MM-DD')).toISOString(),
    name: names[4],
    displayName: `${names[4]} ${urls[4]}`,
    active: true,
    funder: false,
    types: [],
    acronyms: [],
    aliases: [],
    countryCode: casual.country_code,
    countryName: casual.country,
    domain: urls[4],
  },
]

export const searchData = [
  {
    "id": "https://ror.org/01nrxwf90",
    "fetchId": "ror.org/01nrxwf90",
    "name": "University of Edinburgh",
    "displayName": "University of Edinburgh (ed.ac.uk)",
    "funder": true,
    "fundref": "http://dx.doi.org/10.13039/501100000848",
    "aliases": [],
    "countryCode": "gb",
    "countryName": "United Kingdom",
    "links": ["ed.ac.uk", "http://www.ed.ac.uk/home"],
    "locales": [],
  },
  {
    "id": "https://ror.org/01tm6cn81",
    "fetchId": "ror.org/01tm6cn81",
    "name": "University of Gothenburg",
    "displayName": "University of Gothenburg (gu.se)",
    "funder": false,
    "fundref": "",
    "aliases": [],
    "countryCode": "se",
    "countryName": "Sweden",
    "links": ["gu.se", "http://www.gu.se/english"],
    "locales": [
      {
        "label": "Göteborgin yliopisto (gu.se)",
        "iso639": "fi",
      },
      {
        "label": "Göteborgs universitet (gu.se)",
        "iso639": "sv",
      }
    ],
  },
  {
    "id": "https://ror.org/01cwqze88",
    "fetchId": "ror.org/01cwqze88",
    "name": "National Institutes of Health",
    "displayName": "National Institutes of Health (nih.gov)",
    "funder": true,
    "fundref": "http://dx.doi.org/10.13039/100000002",
    "aliases": ["NIH"],
    "countryCode": "us",
    "countryName": "United States",
    "links": ["http://www.nih.gov/"],
    "locales": [],
  },
  {
    "id": "https://ror.org/00dmfq477",
    "fetchId": "ror.org/00dmfq477",
    "name": "University of California Office of the President",
    "displayName": "University of California Office of the President (ucop.edu)",
    "funder": true,
    "fundref": "http://dx.doi.org/10.13039/100014576",
    "aliases": ["UCOP"],
    "countryCode": "us",
    "countryName": "United States",
    "links": ["https://www.ucop.edu"],
    "locales": [],
  },
  {
    "id": "https://dmptool.org/orgs/12345",
    "fetchId": "dmptool.org/orgs/12345",
    "name": "Example University",
    "displayName": "Example University (example.edu)",
    "funder": false,
    "fundref": "",
    "aliases": ["EU"],
    "countryCode": "us",
    "countryName": "United States",
    "links": ["http://www.example.edu/library/"],
    "locales": [],
  },
]

export const mock = {
  // Return a random item from the data array
  Affiliation: () => new Affiliation(data[Math.floor(Math.random() * data.length)]),

  Affiliations: () => searchData.map((rec) => new AffiliationSearch(rec)),
}
