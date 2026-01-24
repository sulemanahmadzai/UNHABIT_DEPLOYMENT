import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);
  
  // Determine status code
  let status = err.status || err.statusCode || 500;
  if (status < 400) status = 500;
  
  // Extract error message
  let message = err.message || "Something went wrong";
  
  // Check for Zod validation errors (multiple ways to detect)
  let issues: any[] = [];
  let isZodError = false;
  
  // Method 1: Direct ZodError instance
  if (err instanceof ZodError) {
    isZodError = true;
    issues = err.issues;
  }
  // Method 2: Check name property
  else if (err.name === 'ZodError' && err.issues && Array.isArray(err.issues)) {
    isZodError = true;
    issues = err.issues;
  }
  // Method 3: Check if message is a stringified ZodError array
  else if (typeof err.message === 'string' && err.message.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(err.message);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].code && parsed[0].path) {
        isZodError = true;
        issues = parsed;
      }
    } catch {
      // Not JSON, continue
    }
  }
  // Method 4: Check error string representation
  else {
    const errorStr = JSON.stringify(err);
    if (errorStr.includes('"code":"invalid_format"') || 
        errorStr.includes('"code":"too_small"') ||
        errorStr.includes('"code":"too_big"')) {
      isZodError = true;
      // Try to extract from string
      try {
        const match = errorStr.match(/\[.*?\]/);
        if (match) {
          issues = JSON.parse(match[0]);
        }
      } catch {
        // Couldn't parse
      }
    }
  }
  
  if (isZodError) {
    status = 400;
    if (issues.length > 0) {
      message = `Validation error: ${issues.map((e: any) => {
        const path = Array.isArray(e.path) ? e.path.join('.') : (e.path || 'unknown');
        return `${path}: ${e.message}`;
      }).join(', ')}`;
    } else {
      message = `Validation error: ${err.message || 'Invalid input'}`;
    }
    
    return res.status(status).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && {
        details: err.stack,
        validationErrors: issues.length > 0 ? issues : undefined
      })
    });
  }
  
  // Check for network/DNS errors (Supabase connectivity issues)
  if (err.cause && err.cause.code === 'ENOTFOUND') {
    status = 503; // Service Unavailable
    message = `Cannot connect to Supabase: ${err.cause.hostname || 'unknown host'}. Please check your SUPABASE_URL environment variable and network connectivity.`;
  } else if (err.message && err.message.includes('fetch failed')) {
    status = 503;
    message = `Network error: Cannot reach Supabase service. Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.`;
  }
  
  // Check for authentication errors
  if (err.message && (
    err.message.includes('Invalid login credentials') ||
    err.message.includes('Invalid credentials') ||
    err.message.includes('User not found') ||
    err.message.includes('Email not confirmed')
  )) {
    status = 401;
  }
  
  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      details: err.stack,
      originalError: err.cause || err
    })
  });
}
