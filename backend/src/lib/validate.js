import { z } from 'zod';

export { z };

// Valide `data` avec un schéma zod ; lève une erreur 400 avec un message lisible sinon.
export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue.path.join('.');
  const err = new Error(field ? `${field} : ${issue.message}` : issue.message);
  err.status = 400;
  throw err;
}

// Chaîne non vide après trim.
export const nonEmpty = (label) => z.string({ error: `${label} requis` }).trim().min(1, `${label} requis`);
