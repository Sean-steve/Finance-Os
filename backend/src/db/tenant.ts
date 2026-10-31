import type pg from 'pg';

/**
 * SECURITY BOUNDARY (B1): call only after the server verifies authenticated actor,
 * workspace membership and role. Never accept actorId/workspaceId directly from
 * an unverified request header, query string or JSON body.
 *
 * SET LOCAL is transaction-scoped; the pool is never left with another tenant's
 * session variables. Fail closed on rollback and release.
 */
export async function withWorkspace<T>(
  pool: pg.Pool,
  actorId: string,
  workspaceId: string,
  work: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const uuid = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
  if (!uuid.test(actorId) || !uuid.test(workspaceId)) throw new Error('Invalid principal or workspace ID');
  const client = await pool.connect();
  let begun = false;
  try {
    await client.query('BEGIN');
    begun = true;
    await client.query('SELECT set_config($1, $2, true)', ['app.actor_id', actorId]);
    await client.query('SELECT set_config($1, $2, true)', ['app.workspace_id', workspaceId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (begun) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
