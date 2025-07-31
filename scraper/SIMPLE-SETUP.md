# SUPER-SIMPLE SET-UP  
*(No coding experience needed!)*

> Goal: give the scraper **three secret keys** so it can talk to the database and to Google AI.  
> Time: **≈ 10 minutes**

---

## 1.  What are “keys” and why do I need them?
| Friendly Name | What it does | Where we get it |
|---------------|-------------|-----------------|
| **Supabase URL** | Tells the scraper *where* the online database lives. | Supabase web site |
| **Supabase Service Role Key** | Big golden key that lets the scraper **save new shows**. | Supabase web site |
| **Google AI Key** | Lets the scraper use Google’s brain to read web pages. | Google MakerSuite web site |

We will put the three keys into a special note file called **“.env”**.  
Each time the scraper runs it quietly reads that file and knows what to do.

---

## 2.  Make the “.env” file

1. Open your project folder called **card-show-finder** (double-click it).  
2. Open the inside folder named **scraper** (double-click again).  
3. Inside you will see a file called **.env.example**  
   *This is a template – we’ll make a copy we can edit.*
4. **Right-click** on **.env.example** ➜ choose **Copy**.  
5. **Right-click** in empty space ➜ choose **Paste**.  
6. You now have a file named something like “*.env copy*”.  
7. **Right-click ➜ Rename** ➜ type `.env` (just those four characters) ➜ **Enter**.  

🎉 You just created the `.env` file!

---

## 3.  Get the three keys

### A.  Supabase keys
1. Open a web browser and go to `https://app.supabase.com`.  
2. Log in and click on **your project**.  
3. Left side menu ➜ **Settings** ➜ **API**.  
   * Write down two things:*  
   • **Project URL** (looks like `https://abcd.supabase.co`)  
   • **Service role key** (a very long line of letters/numbers)  

### B.  Google AI key
1. Open a new browser tab and go to `https://makersuite.google.com`.  
2. Sign in with your Google account.  
3. Click **API keys** (left menu).  
4. Click **Create API key** ➜ **Copy** the key that appears (starts with `AIzaSy...`).  

---

## 4.  Put keys into the “.env” file

1. **Double-click** the `.env` file (opens in Notepad on Windows or TextEdit on Mac).  
2. Remove the example text and add your real keys like this **(no spaces!)**  

```
SUPABASE_URL=https://abcd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-super-long-service-role-key
GOOGLE_AI_KEY=your-google-ai-key
```

3. Click **Save** (*File ➜ Save*). Close the window.

---

## 5.  Tell the computer about the keys  
*(This is the only “terminal” step – we’ll guide you click by click.)*

| Windows (PowerShell) | Mac (Terminal) |
|----------------------|----------------|
| 1. Press **Windows key**. <br>2. Type **powershell**. <br>3. Click **Windows PowerShell**. | 1. Press **⌘ (Command) + Space**. <br>2. Type **Terminal**. <br>3. Press **Enter**. |
| In the blue window type (**copy-paste is ok**): <br>`cd Desktop\\card-show-finder` <br>(Change “Desktop” if your folder lives somewhere else, e.g. `Documents\\card-show-finder`.) | In the white window type: <br>`cd ~/Desktop/card-show-finder` <br>(Change the path if your folder is elsewhere.) |
| Now load the keys by typing: <br>`type .env | foreach {if($_ -match \"=\"){ $k,$v=$_ -split \"=\"; setx $k $v }}` <br>Press **Enter** and wait for “SUCCESS” messages. <br>*This copies each line of `.env` into Windows permanent variables.* | Load the keys by typing: <br>`export $(grep -v '^#' .env | xargs)` <br>Press **Enter**. <br>*This command tells the Mac to remember the keys for this window.* |

You are done! Keep this window open – you’ll run the next command here.

---

## 6.  Test that everything works

Still inside the terminal window, type:

```
npm run scraper:inspect:stats
```

• If you see some numbers (and no big red error) → **Success!**  
• If you see “Missing Supabase URL” or other errors, check the **Common Mistakes** table below.

---

## 7.  Common Mistakes (and quick fixes)

| Message you see | What it means | How to fix |
|-----------------|--------------|------------|
| **Missing Supabase URL** | The scraper can’t find the first line in your `.env`. | Open `.env`, check spelling. Save again. Reload keys (Step 5). |
| **Invalid service role key** | Key copied only partly. | Copy the full key from Supabase API page again. Paste into `.env`. |
| **“.env not found”** | File name wrong. | Make sure file is exactly `.env`, inside the **scraper** folder. |
| **Google AI 403** | Google key wrong or not active. | Make a new API key in MakerSuite, update `.env`, reload keys. |

---

## 8.  Next Step – Run the scraper!

Ready to collect shows? In the same terminal window type:

```
npm run scraper:csv
```

The scraper will read your keys and start saving shows to the database.  
Watch the magic happen – and happy collecting! 🎉

