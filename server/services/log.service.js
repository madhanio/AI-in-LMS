import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * UPGRADE 8 — LOG SERVICE
 * Silent background logging to Supabase `query_logs` table.
 * Fire-and-forget: callers use logService.log(...).catch() — no await in hot path.
 *
 * Table schema (apply via Supabase migration):
 * CREATE TABLE query_logs (
 *   id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *   created_at       timestamptz DEFAULT now(),
 *   roll_number      text,
 *   raw_query        text,
 *   cleaned_query    text,
 *   intent           text,
 *   subject          text,
 *   active_module    int,
 *   latency_ms       int,
 *   used_source_context boolean,
 *   validation_flag  text,
 *   was_fallback     boolean
 * );
 */
export class LogService {
  /**
   * Log a query event to Supabase.
   * Non-blocking — caller should NOT await this.
   *
   * @param {Object} payload
   * @param {string}  payload.rollNumber
   * @param {string}  payload.rawQuery
   * @param {string}  payload.cleanedQuery
   * @param {string}  payload.intent
   * @param {string}  payload.subject
   * @param {number|null} payload.activeModule
   * @param {number}  payload.latencyMs
   * @param {boolean} payload.usedSourceContext
   * @param {string|null} payload.validationFlag  — null | 'empty' | 'contradiction' | 'wrong_module' | 'exam_mode'
   * @param {boolean} payload.wasFallback
   */
  async log({
    rollNumber       = null,
    rawQuery         = '',
    cleanedQuery     = '',
    intent           = null,
    subject          = null,
    activeModule     = null,
    latencyMs        = 0,
    usedSourceContext = false,
    validationFlag   = null,
    wasFallback      = false,
  } = {}) {
    try {
      const { error } = await supabase
        .from('query_logs')
        .insert([{
          roll_number:          rollNumber,
          raw_query:            rawQuery,
          cleaned_query:        cleanedQuery,
          intent,
          subject,
          active_module:        activeModule,
          latency_ms:           latencyMs,
          used_source_context:  usedSourceContext,
          validation_flag:      validationFlag,
          was_fallback:         wasFallback,
        }]);

      if (error) {
        console.error('📊 Log write error (non-critical):', error.message);
      }
    } catch (e) {
      // Never throw — logging must never break the main response flow
      console.error('📊 LogService exception (non-critical):', e.message);
    }
  }
}

export const logService = new LogService();
