import { paymentEventsCache, prunePayEvents, OperationType } from '../fxPaymentEventsCache';

jest.mock('polyapi', () => ({
  tabi: {
    ohip: {
      paymentEventsCache: {
        selectOne: jest.fn(),
        deleteOne: jest.fn(),
        deleteMany: jest.fn()
      }
    }
  }
}));

import { tabi } from 'polyapi';

describe('fxPaymentEventsCache additional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('DELETE outer catch: synchronous throw inside try is caught and returns error', async () => {
    (tabi.ohip.paymentEventsCache.selectOne as jest.Mock).mockResolvedValueOnce({ id: 'pid', event: {} });
    (tabi.ohip.paymentEventsCache.deleteOne as jest.Mock).mockImplementation(() => {
      // Synchronous throw (not a rejected promise) to trigger outer catch
      throw new Error('boom');
    });
    const res = await paymentEventsCache('pid', OperationType.DELETE);
    expect(res).toEqual({ error: 'Record with Payment ID pid not found.' });
  });

  it('prunePayEvents outer catch: missing params causes failure before deleteMany', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await prunePayEvents({}, {}, undefined as any);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
