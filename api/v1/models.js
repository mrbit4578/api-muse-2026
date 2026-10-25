// API Handler: OpenAI Compatible Models List
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-muse-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const models = [
    {
      id: 'muse-spark-1.1',
      object: 'model',
      created: 1718000000,
      owned_by: 'muse.ai',
      permission: [],
      root: 'muse-spark-1.1',
      parent: null,
      description: 'Model Muse Spark 1.1 thế hệ mới nhất, suy luận logic và hội thoại thông minh tốc độ cao'
    },
    {
      id: 'muse-chat-v2',
      object: 'model',
      created: 1715000000,
      owned_by: 'muse.ai',
      permission: [],
      root: 'muse-chat-v2',
      parent: null,
      description: 'Model Muse Chat tối ưu cho đa ngôn ngữ và tiếng Việt'
    },
    {
      id: 'muse-omni-flash',
      object: 'model',
      created: 1720000000,
      owned_by: 'muse.ai',
      permission: [],
      root: 'muse-omni-flash',
      parent: null,
      description: 'Model đa phương thức siêu nhanh, hỗ trợ xử lý text và visual context'
    },
    {
      id: 'gpt-4o-muse',
      object: 'model',
      created: 1716000000,
      owned_by: 'muse.ai',
      permission: [],
      root: 'gpt-4o-muse',
      parent: null,
      description: 'OpenAI alias tương thích cho client tự động nhận diện gpt-4o'
    },
    {
      id: 'dall-e-3-muse',
      object: 'model',
      created: 1717000000,
      owned_by: 'muse.ai',
      permission: [],
      root: 'dall-e-3-muse',
      parent: null,
      description: 'Model sinh ảnh nghệ thuật độ phân giải cao'
    }
  ];

  return res.status(200).json({
    object: 'list',
    data: models
  });
};
