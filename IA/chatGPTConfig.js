import axios from "axios";
import { OPENAI_API_KEY } from "./secret.local"; // ← import local, no versionado

// Cliente Axios para OpenAI
const api = axios.create({
  baseURL: "https://api.openai.com/v1",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  },
  timeout: 30000,
});


// ---- Utilidades de normalizaci贸n ----
function normalizeOne(obj, level, category) {
  if (!obj || typeof obj !== "object") return null;

  const tipo = obj.tipo || obj.type; // por si viene en espa帽ol/ingl茅s

  // Tipo "emparejamiento" / "matching"
  if (tipo === "emparejamiento" || obj.type === "matching") {
    const left = obj.izquierda ?? obj.left;
    const right = obj.derecha ?? obj.right;
    const pairs = obj.respuestas ?? obj.pairs;

    return {
      type: "matching",
      level,
      category,
      instructions: obj.instrucciones ?? obj.instructions ?? "",
      left: Array.isArray(left) ? left : [],
      right: Array.isArray(right) ? right : [],
      pairs: Array.isArray(pairs) ? pairs : [],
      explanation: obj.explicacion ?? obj.explanation ?? "",
    };
  }

  // Default: opci贸n m煤ltiple
  const opciones = obj.opciones ?? obj.options;
  return {
    type: "multiple",
    level,
    category,
    question: obj.pregunta ?? obj.question ?? "",
    options: Array.isArray(opciones) ? opciones : [],
    answer: obj.respuesta ?? obj.answer ?? "",
    explanation: obj.explicacion ?? obj.explanation ?? "",
  };
}

const shuffleInPlace = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---- Generador principal ----
/**
 * Genera un LOTE de ejercicios y los devuelve normalizados (NO guarda).
 * Devuelve balance 50% multiple / 50% matching (o lo m谩s cercano posible).
 */
export async function generarLote(level, category, count = 10) {
  const cat = String(category || "").toLowerCase();
  const lev = String(level || "").toLowerCase();
  const n = Math.max(1, Math.min(200, parseInt(count || 1, 10)));

  const sys =
    `Eres un generador de ejercicios para estudiantes de 7掳.` +
    ` Categor铆a: ${cat}. Nivel: ${lev}.` +
    ` Debes generar ejercicios de:` +
    ` - Fracciones: suma, resta, multiplicaci贸n, divisi贸n, simplificaci贸n, comparaci贸n.` +
    ` - 脕lgebra: expresiones, evaluaci贸n, propiedades, simplificaci贸n b谩sica.` +
    ` - Igualdades: lineales de una inc贸gnita.` +
    ` Entrega 50% opci贸n m煤ltiple (4 opciones) y 50% emparejamiento.` +
    ` Sin repeticiones dentro del lote. Resultados num茅ricos limpios.` +
    ` Responde SOLO un array JSON v谩lido, sin texto antes ni despu茅s.`;

  const user =
`Genera EXACTAMENTE ${n} ejercicios NUEVOS en el siguiente formato como un ARRAY JSON (no envuelvas en objeto):

[
  {
    "tipo": "opcion_multiple",
    "pregunta": "string",
    "opciones": ["string","string","string","string"],
    "respuesta": "string",
    "explicacion": "string"
  },
  {
    "tipo": "emparejamiento",
    "instrucciones": "string",
    "izquierda": ["string","string","string","string"],
    "derecha": ["string","string","string","string"],
    "respuestas": [[0,1],[1,2],[2,3],[3,0]],
    "explicacion": "string"
  }
]`;

  const model = "gpt-4o-mini";

  let raw = "[]";

  try {
    const { data } = await api.post("/chat/completions", {
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      // OJO: no usamos response_format para no forzar objeto.
    });

    raw = data?.choices?.[0]?.message?.content ?? "[]";
  } catch (err) {
    // Mensaje de error razonable
    const msg =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Error solicitando ejercicios a OpenAI";
    console.warn("[generarLote] OpenAI error:", msg);
    throw new Error(msg);
  }

  // Parseo robusto (la IA a veces env铆a objeto en vez de array)
  let arr = [];
  try {
    const any = JSON.parse(raw);
    if (Array.isArray(any)) {
      arr = any;
    } else if (any && Array.isArray(any.array)) {
      arr = any.array;
    } else {
      const k = Object.keys(any || {}).find((x) => Array.isArray(any[x]));
      arr = k ? any[k] : [];
    }
  } catch {
    // Si viene con texto basura, intenta limpiar
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        arr = JSON.parse(raw.slice(start, end + 1));
      } catch {
        arr = [];
      }
    } else {
      arr = [];
    }
  }

  const normalized = arr.map((x) => normalizeOne(x, lev, cat)).filter(Boolean);

  // --- Rebalanceo 50/50 ---
  const wantMultiple = Math.floor(n / 2);
  const wantMatching = n - wantMultiple;

  const multiples = shuffleInPlace(normalized.filter((q) => q.type === "multiple"));
  const matchings = shuffleInPlace(normalized.filter((q) => q.type === "matching"));

  const pickMultiples = multiples.slice(0, wantMultiple);
  const pickMatchings = matchings.slice(0, wantMatching);

  let combined = [...pickMultiples, ...pickMatchings];

  if (combined.length < n) {
    const deficit = n - combined.length;
    const leftovers = [
      ...multiples.slice(pickMultiples.length),
      ...matchings.slice(pickMatchings.length),
    ];
    combined = [...combined, ...leftovers.slice(0, deficit)];
  }

  return shuffleInPlace(combined).slice(0, n);
}