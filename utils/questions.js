// utils/questions.js

const asArray = (v) => (Array.isArray(v) ? v : []);

export const normalizeQuestion = (q = {}, fallbackLevel, fallbackCat) => {
  // Unifica campos en español/inglés y estructura segura
  const type =
    q.type === 'matching' || q.tipo === 'emparejamiento'
      ? 'matching'
      : 'multiple';

  const question = q.question ?? q.pregunta ?? q.instructions ?? q.instrucciones ?? '';
  const options  = asArray(q.options ?? q.opciones);
  const left     = asArray(q.left ?? q.izquierda);
  const right    = asArray(q.right ?? q.derecha);
  const pairs    = Array.isArray(q.pairs ?? q.respuestas) ? (q.pairs ?? q.respuestas) : [];
  const answer   = q.answer ?? q.respuesta ?? '';

  return {
    ...q,
    type,
    level: q.level ?? fallbackLevel,
    category: q.category ?? fallbackCat,
    question,
    options,
    left,
    right,
    pairs,
    answer,
    explanation: q.explanation ?? q.explicacion ?? '',
  };
};

export const isMatchingWellFormed = (q) =>
  q?.type === 'matching' && Array.isArray(q.left) && Array.isArray(q.right) && Array.isArray(q.pairs);
