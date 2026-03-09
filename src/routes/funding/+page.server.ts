import { prisma } from '$lib/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
    const page = parseInt(url.searchParams.get('page') || '1');
    const sortBy = url.searchParams.get('sortBy') || 'date';
    const sortOrder = (url.searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const source = url.searchParams.get('source') || 'all';
    const itemsPerPage = 50;
    const skip = (page - 1) * itemsPerPage;

    const where = source !== 'all' ? { source } : {};

    const orderBy =
        sortBy === 'amount'
            ? { amount: sortOrder }
            : sortBy === 'company'
                ? { company: { name: sortOrder } }
                : { date: sortOrder };

    const [events, totalCount] = await Promise.all([
        prisma.fundingEvent.findMany({
            where,
            include: { company: true },
            orderBy,
            skip,
            take: itemsPerPage
        }),
        prisma.fundingEvent.count({ where })
    ]);

    // Get distinct sources for the filter
    const sources = await prisma.fundingEvent
        .findMany({ select: { source: true }, distinct: ['source'] })
        .then((rows) => rows.map((r) => r.source));

    // Summary stats
    const stats = await prisma.fundingEvent.aggregate({
        _sum: { amount: true },
        _count: true
    });

    return {
        events,
        totalCount,
        currentPage: page,
        itemsPerPage,
        sources,
        totalRaised: stats._sum.amount || 0,
        totalEvents: stats._count
    };
};
