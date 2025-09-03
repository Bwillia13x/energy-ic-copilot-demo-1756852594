interface CompanyData {
  name: string
  ticker: string
  currency: string
  fiscal_year_end: string
  sector: string
  country: string
}

export const DEMO_COMPANIES: Record<string, CompanyData> = {
  PSX: {
    name: 'Phillips 66',
    ticker: 'PSX',
    currency: 'USD',
    fiscal_year_end: 'DEC',
    sector: 'Oil & Gas Refining/Marketing',
    country: 'United States',
  },
  SU: {
    name: 'Suncor Energy Inc.',
    ticker: 'SU',
    currency: 'CAD',
    fiscal_year_end: 'DEC',
    sector: 'Integrated Oil & Gas',
    country: 'Canada',
  },
  TRP: {
    name: 'TC Energy',
    ticker: 'TRP',
    currency: 'CAD',
    fiscal_year_end: 'DEC',
    sector: 'Energy Infrastructure',
    country: 'Canada',
  },
}
