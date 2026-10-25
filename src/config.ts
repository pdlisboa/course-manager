import path from 'node:path';

// Todas as configurações vêm de variáveis de ambiente (definidas no Portainer / docker-compose).

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`Variável ${name} inválida: "${raw}"`);
  return value;
}

export const config = {
  /** Pasta com os cursos (montada como volume, de preferência read-only). */
  coursesDir: path.resolve(process.env.COURSES_DIR ?? '/courses'),
  /** Se definido, COURSES_DIR é um único curso com esse nome. */
  courseName: process.env.COURSE_NAME?.trim() || null,
  /** Onde o banco de progresso é salvo. */
  dataDir: path.resolve(process.env.DATA_DIR ?? '/data'),
  /** Senha opcional (HTTP Basic, qualquer usuário). */
  password: process.env.APP_PASSWORD || null,
  /** Fração assistida (0..1) a partir da qual a aula conta como concluída. */
  completeThreshold: numberEnv('COMPLETE_THRESHOLD', 0.9),
  port: numberEnv('PORT', 3000),
};
