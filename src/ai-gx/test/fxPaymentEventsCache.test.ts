import { paymentEventsCache, prunePayEvents, OperationType } from '../fxPaymentEventsCache';

jest.mock('polyapi', () => ({
  tabi: {
    ohip: {
      paymentEventsCache: {
        selectOne: jest.fn(),
        insertOne: jest.fn(),
        upsertOne: jest.fn(),
        deleteOne: jest.fn(),
        deleteMany: jest.fn()
      }
    }
  }
}));

// pull mocked tabi from the module mock for typing convenience
import { tabi } from 'polyapi';

describe('fxPaymentEventsCache edge cases', () => {
  const event: any = {
    additionalData: {
      cardSummary: '1111',
      shopperCountry: 'GB',
      paymentLinkId: 'PLINK'
    },
    eventDate: '2023-09-05T20:02:13+02:00'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('UPSERT without payload should return error', async () => {
    const res = await paymentEventsCache('pid', OperationType.UPSERT);
    expect(res).toEqual({ error: 'no event payload provided' });
  });

  it('selectOne throws -> returns "Error searching for event."', async () => {
    (tabi.ohip.paymentEventsCache.selectOne as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const res = await paymentEventsCache('pid', OperationType.READ);
    expect(res).toEqual({ error: 'Error searching for event.' });
  });

  it('insert path: insertOne rejects but function still returns event and logs error', async () => {
    (tabi.ohip.paymentEventsCache.selectOne as jest.Mock).mockResolvedValueOnce(null);
    (tabi.ohip.paymentEventsCache.insertOne as jest.Mock).mockRejectedValueOnce(new Error('insert failed'));

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await paymentEventsCache('pid', OperationType.UPSERT, event);

    expect(res).toEqual(event);
    expect(tabi.ohip.paymentEventsCache.insertOne).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('upsert path: upsertOne rejects but function still returns event and logs error', async () => {
    (tabi.ohip.paymentEventsCache.selectOne as jest.Mock).mockResolvedValueOnce({ id: 'pid', event });
    (tabi.ohip.paymentEventsCache.upsertOne as jest.Mock).mockRejectedValueOnce(new Error('upsert failed'));

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await paymentEventsCache('pid', OperationType.UPSERT, event);

    expect(res).toEqual(event);
    expect(tabi.ohip.paymentEventsCache.upsertOne).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('READ not found -> returns error', async () => {
    (tabi.ohip.paymentEventsCache.selectOne as jest.Mock).mockResolvedValueOnce(null);
    const res = await paymentEventsCache('pid', OperationType.READ);
    expect(res).toEqual({ error: 'Record with Payment ID pid not found.' });
  });

  it('DELETE not found -> returns error', async () => {
    (tabi.ohip.paymentEventsCache.selectOne as jest.Mock).mockResolvedValueOnce(null);
    const res = await paymentEventsCache('pid', OperationType.DELETE);
    expect(res).toEqual({ error: 'Record with Payment ID pid not found.' });
  });

  it('DELETE success: deleteOne called with id and resolves void', async () => {
    (tabi.ohip.paymentEventsCache.selectOne as jest.Mock).mockResolvedValueOnce({ id: 'pid', event });
    (tabi.ohip.paymentEventsCache.deleteOne as jest.Mock).mockResolvedValueOnce({});
    const res = await paymentEventsCache('pid', OperationType.DELETE);
    expect(tabi.ohip.paymentEventsCache.deleteOne).toHaveBeenCalledWith('pid');
    expect(res).toBeUndefined();
  });

  it('DELETE deleteOne rejects -> logs error and resolves', async () => {
    (tabi.ohip.paymentEventsCache.selectOne as jest.Mock).mockResolvedValueOnce({ id: 'pid', event });
    (tabi.ohip.paymentEventsCache.deleteOne as jest.Mock).mockRejectedValueOnce(new Error('delete failed'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await paymentEventsCache('pid', OperationType.DELETE);
    expect(spy).toHaveBeenCalled();
    expect(res).toBeUndefined();
    spy.mockRestore();
  });

  it('prunePayEvents happy path calls deleteMany with cutoff', async () => {
    (tabi.ohip.paymentEventsCache.deleteMany as jest.Mock).mockResolvedValueOnce({ deleted: 3 });
    const olderThan = 0.01;
    await prunePayEvents({}, {}, { olderThan });
    expect(tabi.ohip.paymentEventsCache.deleteMany).toHaveBeenCalledTimes(1);
    const arg = (tabi.ohip.paymentEventsCache.deleteMany as jest.Mock).mock.calls[0][0];
    expect(arg).toHaveProperty('where.createdAt.lt');
    expect(typeof arg.where.createdAt.lt).toBe('string');
  });

  it('prunePayEvents error -> logs error but resolves', async () => {
    (tabi.ohip.paymentEventsCache.deleteMany as jest.Mock).mockRejectedValueOnce(new Error('prune failed'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await prunePayEvents({}, {}, { olderThan: 1 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
