import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import GogoanimeScraper from '../../utils/gogoanime';

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  const gogoanime = new GogoanimeScraper();

  fastify.get('/', (_, rp) => {
    rp.status(200).send({
      intro:
        "Welcome to the Gogoanime provider: check out the provider's website @ https://gogoanime.by/",
      routes: ['/:query', '/info/:id', '/watch/:episodeId', '/recent-episodes'],
      documentation: 'https://docs.consumet.org/#tag/gogoanime',
    });
  });

  fastify.get('/recent-episodes', async (request: FastifyRequest, reply: FastifyReply) => {
    const page = (request.query as { page: number }).page;
    try {
      const res = await gogoanime.fetchRecentEpisodes(page);
      reply.status(200).send(res);
    } catch (err) {
      reply.status(500).send({
        message: 'Something went wrong. Contact developer for help.',
      });
    }
  });

  fastify.get('/:query', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.params as { query: string }).query;
    const page = (request.query as { page: number }).page;

    if (query === 'recent-episodes') return;

    try {
      const res = await gogoanime.search(query, page);
      reply.status(200).send(res);
    } catch (err) {
      reply.status(500).send({
        message: 'Something went wrong. Contact developer for help.',
      });
    }
  });

  fastify.get('/info/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = decodeURIComponent((request.params as { id: string }).id);

    try {
      const res = await gogoanime
        .fetchAnimeInfo(id)
        .catch((err) => reply.status(404).send({ message: err }));
      reply.status(200).send(res);
    } catch (err) {
      reply.status(500).send({
        message: 'Something went wrong. Contact developer for help.',
      });
    }
  });

  fastify.get(
    '/watch/:episodeId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const episodeId = (request.params as { episodeId: string }).episodeId;

      if (typeof episodeId === 'undefined')
        return reply.status(400).send({ message: 'episodeId is required' });

      try {
        const res = await gogoanime
          .fetchEpisodeSources(episodeId)
          .catch((err) => reply.status(404).send({ message: err }));
        reply.status(200).send(res);
      } catch (err) {
        reply.status(500).send({
          message: 'Something went wrong. Contact developer for help.',
        });
      }
    },
  );
};

export default routes;
