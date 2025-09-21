import { v4 as uuidv4 } from 'uuid';

export const requestId = (req, res, next) => {
  req.id = req.get('X-Request-ID') || uuidv4();
  res.set('X-Request-ID', req.id);
  next();
};