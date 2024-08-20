const crypto = require('crypto')
const { Shift4Gateway } = require('../../')
const cards = require('../data/cards')
const charges = require('../data/charges')
const assertShift4Exception = require("./assertShift4Exception");

describe('Disputes', function () {
  const api = new Shift4Gateway()

  it('should get dispute', async () => {
    // given
    const [dispute, charge] = await createDispute()
    // when
    const got = await api.disputes.get(dispute.id)
    // then
    expect(got.charge.id).toEqual(charge.id)
  })

  it('should update dispute', async () => {
    // given
    const [dispute] = await createDispute()
    const customerName = 'Test Customer'
    // when
    const got = await api.disputes.update(dispute.id, { evidence: { customerName } })
    // then
    expect(got.evidence.customerName).toEqual(customerName)
  })

  it('should close dispute', async () => {
    // given
    const [dispute] = await createDispute()
    // when
    await api.disputes.close(dispute.id)
    const got = await api.disputes.get(dispute.id)
    // then
    expect(got.acceptedAsLost).toBeTrue()
  })

  it('should list dispute', async () => {
    // given
    const [dispute] = await createDispute()
    // when
    const ids = (await api.disputes.list({ limit: 100 }))
      .list.map(it => it.id)
    // then
    expect(ids).toContain(dispute.id)
  })

  const createDispute = async () => {
    let charge = await api.charges.create(charges.charge({ card: cards.disputedCard() }))
    for (let i = 0; i < 30; i++) {
      charge = await api.charges.get(charge.id)
      if (charge.disputed) {
        const disputes = await api.disputes.list({ limit: 100 })
        const dispute = disputes.list.find(it => it.charge.id === charge.id)
        return [dispute, charge]
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    throw new Error('timeout')
  }

  it('should throw exception if same idempotency key is used for two different update requests', async () => {
    // given
    const idempotencyKey = crypto.randomUUID()

    const [dispute] = await createDispute()
    const customerName = 'Test Customer'
    const updateRequest = { evidence: { customerName } }

    // when
    await api.disputes.update(dispute.id, updateRequest, { 'idempotencyKey': idempotencyKey})
    updateRequest['evidence']['customerName'] = 'Different Customer'
    const exception = await assertShift4Exception(() => api.disputes.update(dispute.id, updateRequest, { 'idempotencyKey': idempotencyKey}))

    // then
    expect(exception.type).toEqual('invalid_request')
    expect(exception.message).toEqual('Idempotent key used for request with different parameters.')
  })
})
