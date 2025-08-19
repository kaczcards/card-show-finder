# Next Steps for Deploying the Show-Creation Fix

1. **Database – one-time**
   • Open Supabase → SQL Editor  
   • Run the SQL from `COORDINATE_FIX_INSTRUCTIONS.md`  
     – drops *trigger_log_null_coordinates*  
     – installs the PostGIS-aware trigger/function  
   • Run `create-show-with-coordinates.sql` to create the RPC `create_show_with_coordinates` and grant `EXECUTE` to `authenticated`.

2. **Code**
   • Merge branch **`fix-show-creation-coordinates`** → `main` (includes updated `AddShowScreen.tsx`).  
   • Pull latest `main` on all developer machines.

3. **Mobile App**
   • Clear cache & start: `expo start -c` (dev) or run **EAS build** (prod).  
   • Publish OTA update if using Expo managed workflow.

4. **Smoke-test**
   • Log in as Show Organizer → **Add Show** with a real address.  
   • Confirm: no crash, success toast, pin appears on Map & Dashboard.

5. **Post-deployment clean-up**
   • Monitor `coordinate_issues` table for new rows (should stay empty).  
   • Remove any temporary test shows created during validation.

Total time: ≈ 15 minutes. Once completed, organizers can create shows without errors.
