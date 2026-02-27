export const defaultPresets = [
  {
    id: 'listMarkets',
    label: 'List Markets',
    description: 'Fetch a paginated list of active markets.',
    category: 'Discovery',
    argsTemplate: ['markets', 'list', '--json'],
    requiredParams: []
  },
  {
    id: 'marketDetail',
    label: 'Market Detail',
    description: 'Inspect market metadata, probabilities, and status.',
    category: 'Research',
    argsTemplate: ['markets', 'show', '--id', '{{marketId}}', '--json'],
    requiredParams: ['marketId']
  },
  {
    id: 'orderBook',
    label: 'Order Book',
    description: 'Pull depth and top-of-book for one market.',
    category: 'Research',
    argsTemplate: ['markets', 'orderbook', '--id', '{{marketId}}', '--json'],
    requiredParams: ['marketId']
  },
  {
    id: 'openPositions',
    label: 'Open Positions',
    description: 'Show currently open positions for the configured account.',
    category: 'Portfolio',
    argsTemplate: ['account', 'positions', '--json'],
    requiredParams: []
  },
  {
    id: 'openOrders',
    label: 'Open Orders',
    description: 'Show active orders.',
    category: 'Portfolio',
    argsTemplate: ['orders', 'list', '--json'],
    requiredParams: []
  },
  {
    id: 'placeBuyOrder',
    label: 'Place BUY Order',
    description: 'Submit a buy order for a specific market outcome.',
    category: 'Execution',
    argsTemplate: [
      'orders',
      'place',
      '--id',
      '{{marketId}}',
      '--side',
      'buy',
      '--outcome',
      '{{outcome}}',
      '--price',
      '{{price}}',
      '--size',
      '{{size}}',
      '--json'
    ],
    requiredParams: ['marketId', 'outcome', 'price', 'size']
  },
  {
    id: 'placeSellOrder',
    label: 'Place SELL Order',
    description: 'Submit a sell order for a specific market outcome.',
    category: 'Execution',
    argsTemplate: [
      'orders',
      'place',
      '--id',
      '{{marketId}}',
      '--side',
      'sell',
      '--outcome',
      '{{outcome}}',
      '--price',
      '{{price}}',
      '--size',
      '{{size}}',
      '--json'
    ],
    requiredParams: ['marketId', 'outcome', 'price', 'size']
  },
  {
    id: 'cancelOrder',
    label: 'Cancel Order',
    description: 'Cancel an existing order by order id.',
    category: 'Execution',
    argsTemplate: ['orders', 'cancel', '--order-id', '{{orderId}}', '--json'],
    requiredParams: ['orderId']
  }
];

