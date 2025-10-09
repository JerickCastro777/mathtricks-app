import axios from "axios";

const OPENAI_API_KEY = "";

const api = axios.create({
  baseURL: "https://api.openai.com/v1",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  },
});

function normalizeOne(obj, level, category) {
  if (!obj || typeof obj !== "object") return null;

  const tipo = obj.tipo || obj.type; // por si acaso
  if (tipo === "emparejamiento" || obj.type === "matching") {
    return {
      type: "matching",
      level, category,
      instructions: obj.instrucciones ?? obj.instructions ?? "",
      left: Array.isArray(obj.izquierda ?? obj.left) ? (obj.izquierda ?? obj.left) : [],
      right: Array.isArray(obj.derecha ?? obj.right) ? (obj.derecha ?? obj.right) : [],
      pairs: Array.isArray(obj.respuestas ?? obj.pairs) ? (obj.respuestas ?? obj.pairs) : [],
      explanation: obj.explicacion ?? obj.explanation ?? "",
    };
  }

  return {
    type: "multiple",
    level, category,
    question: obj.pregunta ?? obj.question ?? "",
    options: Array.isArray(obj.opciones ?? obj.options) ? (obj.opciones ?? obj.options) : [],
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

/**
 * Genera un LOTE de ejercicios y los devuelve normalizados (NO guarda).
 * Devuelve balance 50% multiple / 50% matching (o lo más cercano posible si la IA no cumple).
 */
export async function generarLote(level, category, count = 10) {
  const cat = String(category || "").toLowerCase();
  const lev = String(level || "").toLowerCase();
  const n = Math.max(1, Math.min(200, parseInt(count || 1, 10)));

  const sys = `Eres un generador de ejercicios para 7°.
Categoría: ${cat}. Nivel: ${lev}.
- Fracciones: suma/resta/mult/div, simplificación, comparación.
- Álgebra: expresiones, evaluación, propiedades, simplificación básica.
- Ecuaciones: lineales de una incógnita.
- 50% opción múltiple (4 opciones) y 50% emparejamiento.
- No repitas dentro del lote. Resultados limpios.`;

  const user = `Genera EXACTAMENTE ${n} ejercicios NUEVOS y devuelve SOLO un ARRAY JSON:

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

  const { data } = await api.post("/chat/completions", {
    model: "gpt-5",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });

  const raw = data?.choices?.[0]?.message?.content ?? "[]";
  let arr = [];
  try {
    const any = JSON.parse(raw);
    if (Array.isArray(any)) arr = any;
    else if (any && Array.isArray(any.array)) arr = any.array;
    else {
      const k = Object.keys(any || {}).find((x) => Array.isArray(any[x]));
      arr = k ? any[k] : [];
    }
  } catch {
    arr = [];
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
