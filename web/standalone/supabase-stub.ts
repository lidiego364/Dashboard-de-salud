// La versión de un solo archivo no usa Supabase: guarda en el navegador.
export function createBrowserClient(): never {
  throw new Error("Supabase no está disponible en la versión local.");
}
export const createServerClient = createBrowserClient;
