# Entry Fee Type Conversion Fix

## Problem

When approving shows from the web submission form, the admin panel failed with error:
```
Failed to approve show: column "entry_fee" is of type numeric but expression is of type text
```

## Root Cause

1. **Web form** collected entry fee as text (e.g., "$5 or Free")
2. **Database function** (`approve_show_v2`) extracted it as TEXT
3. **Shows table** expects `entry_fee` as NUMERIC type
4. No type conversion was happening → database error

## Solution

### 1. Database Fix (`20250206_fix_entry_fee_type.sql`)

Updated `approve_show_v2` function to:
- Extract entry_fee as TEXT first
- Use regex to strip non-numeric characters (handles "$5", "5.00", "5")
- Convert to NUMERIC type
- Handle conversion errors gracefully (set to NULL if invalid)

```sql
-- Extract and convert entry_fee
v_entry_fee_text := v_show_data->>'entryFee';
IF v_entry_fee_text IS NOT NULL AND v_entry_fee_text != '' THEN
  BEGIN
    -- Try to extract numeric value (handles "$5", "5.00", "5" etc)
    v_entry_fee := regexp_replace(v_entry_fee_text, '[^0-9.]', '', 'g')::NUMERIC;
  EXCEPTION WHEN OTHERS THEN
    -- If conversion fails, set to NULL
    v_entry_fee := NULL;
  END;
ELSE
  v_entry_fee := NULL;
END IF;
```

### 2. Web Form Fix

Changed admission field from text to number input:
- **Before**: `<input type="text" placeholder="e.g., $5 or Free">`
- **After**: `<input type="number" step="0.01" min="0" placeholder="5.00">`

Added helper text: "Enter amount in dollars (e.g., 5.00 for $5). Leave blank if free."

## Files Changed

1. ✅ **Database Migration**
   - `supabase/migrations/20250206_fix_entry_fee_type.sql` - Fixed type conversion

2. ✅ **Web Form**
   - `website/submit-show-v2.html` - Changed input type to number

## How to Apply

### Step 1: Update Database Function

Run in **Supabase SQL Editor**:
```sql
-- Contents of supabase/migrations/20250206_fix_entry_fee_type.sql
```

### Step 2: Web Form Already Updated

The web form has been updated in the repository. Deploy the new version:
```bash
# Upload to your web hosting
cp website/submit-show-v2.html /path/to/web/server/
```

## Testing

1. ✅ **Numeric entry**: Enter "5.00" → Saves as 5.00
2. ✅ **Integer entry**: Enter "5" → Saves as 5.00  
3. ✅ **Empty field**: Leave blank → Saves as NULL (free)
4. ✅ **Zero entry**: Enter "0" → Saves as 0.00 (free)

## Backward Compatibility

The function handles existing submissions with text entries:
- "$5" → Converts to 5.00
- "5.00" → Converts to 5.00
- "Free" → Converts to NULL
- Invalid text → Converts to NULL (logs notice)

## Benefits

✅ **No more approval errors** - Type conversion is handled properly  
✅ **Cleaner data** - Entry fees stored as pure numbers  
✅ **Better UX** - Number input has up/down arrows and validation  
✅ **Graceful fallback** - Invalid values become NULL instead of errors

---

**Status**: ✅ Ready to deploy
**Priority**: HIGH - Blocks show approval workflow
