import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';

// @consumet/extensions currently ships no BOOKS providers at all (Libgen was
// removed and nothing has replaced it yet), so this route is disabled to
// prevent the whole app from crashing on boot. Re-enable once a provider is
// available again.
const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  fastify.get('/', async (request: any, reply: any) => {
    reply.status(200).send('Welcome to Consumet Books 📚');
  });

  fastify.get('/s', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(503).send({
      message: 'No books provider is currently available.',
      error: 'not_implemented',
    });
  });
};

export default routes;
