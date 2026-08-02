import { authorizedFetch } from './authFetch';

async function fetchJson(url: string, fallback: string) {
  const response = await authorizedFetch(url);
  if (!response.ok) throw new Error(fallback);
  return response.json();
}

export const fetchLawDetail = async (
  target: string,
  lawId: string,
  article?: string,
) => {
  try {
    const params = new URLSearchParams({ target, law_id: lawId });
    if (article) params.set('article', article);
    return await fetchJson(
      `/api/airtect/law_search?${params.toString()}`,
      'Failed to fetch law detail',
    );
  } catch (error) {
    console.warn('Airtect law_search error:', error);
    return null;
  }
};

export const fetchLandEumData = async (address: string) => {
  try {
    return await fetchJson(
      `/api/airtect/land/info?address=${encodeURIComponent(address)}`,
      'Failed to fetch land information',
    );
  } catch (error) {
    console.warn('Airtect land integration error:', error);
    return null;
  }
};

export const fetchApplicableLaws = async (address: string) => {
  try {
    return await fetchJson(
      `/api/airtect/applicable_laws?address=${encodeURIComponent(
        address,
      )}&address_type=road`,
      'Failed to fetch applicable laws',
    );
  } catch (error) {
    console.warn('Airtect applicable laws error:', error);
    return null;
  }
};

export const fetchOverview = async (address: string, purpose?: string) => {
  try {
    const params = new URLSearchParams({
      address,
      address_type: 'road',
    });
    if (purpose) params.set('purpose', purpose);
    return await fetchJson(
      `/api/airtect/overview?${params.toString()}`,
      'Failed to fetch overview',
    );
  } catch (error) {
    console.warn('Airtect overview error:', error);
    return null;
  }
};

export const fetchFeasibility = async (
  address: string,
  purpose?: string,
  gfa?: number,
) => {
  try {
    const params = new URLSearchParams({
      address,
      address_type: 'road',
      mode: 'detailed',
    });
    if (purpose) params.set('purpose', purpose);
    if (gfa) params.set('gfa', String(gfa));
    return await fetchJson(
      `/api/airtect/feasibility?${params.toString()}`,
      'Failed to fetch feasibility',
    );
  } catch (error) {
    console.warn('Airtect feasibility error:', error);
    return null;
  }
};

export const fetchSiteShp = async (address: string): Promise<string | null> => {
  try {
    const response = await authorizedFetch(
      `/api/airtect/site_shp?address=${encodeURIComponent(
        address,
      )}&address_type=road&format=binary`,
    );
    if (!response.ok) throw new Error('Failed to fetch site SHP');
    return URL.createObjectURL(await response.blob());
  } catch (error) {
    console.warn('Airtect site SHP error:', error);
    return null;
  }
};
