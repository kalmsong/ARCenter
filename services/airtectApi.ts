export const fetchLawDetail = async (target: string, lawId: string, article?: string) => {
  try {
    let url = `/api/airtect/law_search?target=${target}&law_id=${lawId}`;
    if (article) url += `&article=${encodeURIComponent(article)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch from Airtect Proxy API');

    return await response.json();
  } catch (error) {
    console.warn("FastAPI law_search error:", error);
    return null;
  }
};

export const fetchLandEumData = async (address: string) => {
  try {
    // Proxies through our Express server to avoid CORS/Mixed Content issues
    const response = await fetch(`/api/airtect/land/info?address=${encodeURIComponent(address)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch from Airtect Proxy API');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn("FastAPI (api.airtect.kr) integration error:", error);
    return null;
  }
};

export const fetchApplicableLaws = async (address: string) => {
  try {
    const response = await fetch(`/api/airtect/applicable_laws?address=${encodeURIComponent(address)}&address_type=road`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch applicable laws');
    }

    return await response.json();
  } catch (error) {
    console.warn("FastAPI applicable laws error:", error);
    return null;
  }
};

export const fetchOverview = async (address: string, purpose?: string) => {
  try {
    let url = `/api/airtect/overview?address=${encodeURIComponent(address)}&address_type=road`;
    if (purpose) url += `&purpose=${encodeURIComponent(purpose)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch from Airtect API');
    return await response.json();
  } catch (error) {
    console.warn("FastAPI overview error:", error);
    return null;
  }
};

export const fetchFeasibility = async (address: string, purpose?: string, gfa?: number) => {
  try {
    let url = `/api/airtect/feasibility?address=${encodeURIComponent(address)}&address_type=road&mode=detailed`;
    if (purpose) url += `&purpose=${encodeURIComponent(purpose)}`;
    if (gfa) url += `&gfa=${gfa}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch from Airtect API');
    return await response.json();
  } catch (error) {
    console.warn("FastAPI feasibility error:", error);
    return null;
  }
};

export const fetchSiteShp = async (address: string) => {
  // Returns URL for download
  return `/api/airtect/site_shp?address=${encodeURIComponent(address)}&address_type=road&format=binary`;
};

