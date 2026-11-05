const { z } = require('zod');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      const errors = (result.error.issues || []).map(e => `${e.path?.join('.') || 'field'}: ${e.message}`);
      return res.status(400).json({ error: 'Invalid request', details: errors });
    }
    req.validated = result.data;
    next();
  };
}

// Common schemas
const schemas = {
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  otpCode: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  idParam: z.object({ params: z.object({ id: z.string().min(1, 'ID required') }) }),
  searchQuery: z.object({ query: z.object({ search: z.string().max(200).optional() }) }),
  pagination: z.object({ query: z.object({ limit: z.string().optional(), offset: z.string().optional() }) }),

  authSignup: z.object({
    body: z.object({
      name: z.string().min(1, 'Name required').max(100),
      email: z.string().email('Invalid email'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      role: z.enum(['user', 'artist']).optional(),
    }),
  }),

  authSignin: z.object({
    body: z.object({
      email: z.string().email('Invalid email'),
      password: z.string().min(1, 'Password required'),
    }),
  }),

  otpGenerate: z.object({
    body: z.object({
      email: z.string().email('Invalid email'),
      purpose: z.enum(['signup', 'signin', 'reset']).optional(),
      pendingToken: z.string().optional(),
    }),
  }),

  otpVerify: z.object({
    body: z.object({
      email: z.string().email('Invalid email'),
      code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
      purpose: z.enum(['signup', 'signin', 'reset']).optional(),
      pendingToken: z.string().optional(),
    }),
  }),

  passwordResetConfirm: z.object({
    body: z.object({
      resetToken: z.string().min(1, 'Reset token required'),
      newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    }),
  }),

  playlistCreate: z.object({
    body: z.object({
      title: z.string().min(1, 'Title required').max(200),
      description: z.string().max(1000).optional(),
      cover: z.string().max(500).optional(),
      isPublic: z.boolean().optional(),
    }),
  }),

  songUpload: z.object({
    body: z.object({
      title: z.string().min(1, 'Title required').max(200),
      albumName: z.string().max(200).optional(),
      duration: z.string().optional(),
      mood: z.string().max(50).optional(),
      genre: z.string().max(50).optional(),
    }),
  }),
};

module.exports = { validate, schemas };
