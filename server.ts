import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { 
  generateContent, 
  selectRelevantDocuments, 
  getInitialSuggestions, 
  extractPrinciples, 
  analyzeProjectAddress 
} from "./services/geminiServer";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const HOST = process.env.HOST || "127.0.0.1";

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { prompt, urls, files, useSearch, personalRules, folderContext, activeGroupAddress } = req.body;
      const result = await generateContent(prompt, urls, files, useSearch, personalRules, folderContext, activeGroupAddress);
      res.json(result);
    } catch (error: any) {
      console.error("Gemini Generate Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/select-documents", async (req, res) => {
    try {
      const { query, documents } = req.body;
      const result = await selectRelevantDocuments(query, documents);
      res.json({ selected_ids: result });
    } catch (error: any) {
      console.error("Gemini Select Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/suggestions", async (req, res) => {
    try {
      const { urls, folderName } = req.body;
      const result = await getInitialSuggestions(urls, folderName);
      res.json(result);
    } catch (error: any) {
      console.error("Gemini Suggestions Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/extract-principles", async (req, res) => {
    try {
      const { conversation } = req.body;
      const result = await extractPrinciples(conversation);
      res.json({ principles: result });
    } catch (error: any) {
      console.error("Gemini Principles Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/analyze-address", async (req, res) => {
    try {
      const { address, libraryFolders } = req.body;
      const result = await analyzeProjectAddress(address, libraryFolders);
      res.json(result);
    } catch (error: any) {
      console.error("Gemini Analyze Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/airtect/land/info", async (req, res) => {
    try {
      const { address } = req.query;
      if (!address) {
        return res.status(400).json({ error: "Missing address" });
      }
      // Use http directly as the server proxy ignores Mixed Content
      const targetUrl = `http://api.airtect.kr/land_info?address=${encodeURIComponent(address as string)}&address_type=road`;
      const response = await fetch(targetUrl);
      
      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).send(text);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Airtect API Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/airtect/law_search", async (req, res) => {
    try {
      const { target, law_id, article } = req.query;
      let url = `http://api.airtect.kr/law_search?target=${target}&law_id=${law_id}`;
      if (article) url += `&article=${encodeURIComponent(article as string)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).send(await response.text());
      }
      res.json(await response.json());
    } catch (error: any) {
      console.error("Law Search Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/airtect/applicable_laws", async (req, res) => {
    try {
      const { address } = req.query;
      if (!address) {
        return res.status(400).json({ error: "Missing address" });
      }
      const url = `http://api.airtect.kr/applicable_laws?address=${encodeURIComponent(address as string)}&address_type=road`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).send(await response.text());
      }
      res.json(await response.json());
    } catch (error: any) {
      console.error("Applicable Laws Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.all("/api/airtect/*path", async (req, res) => {
    try {
      const endpoint = Array.isArray(req.params.path) ? req.params.path.join('/') : req.params.path;
      const targetUrl = new URL(`http://api.airtect.kr/${endpoint}`);
      
      // Copy query params
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          targetUrl.searchParams.append(key, value);
        }
      }

      const method = req.method;
      const headers = { ...req.headers };
      delete headers['host']; // Let the fetch client handle the host

      const fetchOptions: RequestInit = {
        method,
        headers: headers as Record<string, string>,
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && req.body && Object.keys(req.body).length > 0) {
          fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(targetUrl.toString(), fetchOptions);
      
      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).send(text);
      }
      
      // Fast APIs can return different content types (like binary for shp)
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        res.json(data);
      } else {
        // Fallback for returning buffers (like for ZIP/SHP)
        const arrayBuffer = await response.arrayBuffer();
        res.set('Content-Type', contentType || 'application/octet-stream');
        res.send(Buffer.from(arrayBuffer));
      }

    } catch (error: any) {
      console.error("Airtect API General Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
