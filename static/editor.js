const supabaseUrl = "https://uhqiwochrsrviqdtaurk.supabase.co";
const supabaseAnonKey = "sb_publishable_3F1q3nziWjsv3GDN9Y_1nQ_OhibY-5k";

const db = supabase.createClient(supabaseUrl, supabaseAnonKey);

const email_input = document.getElementById("email_input");
const password_input = document.getElementById("password_input");
const login_btn = document.getElementById("login_btn");
const login_label = document.getElementById("login_label");

const story_title = document.getElementById("story_title");
const story_body = document.getElementById("story_body");
const story_summary = document.getElementById("story_summary");
const story_part = document.getElementById("story_part");
const comment_enabled = document.getElementById("comment_enabled");
const save_btn = document.getElementById("save_btn");

login_btn.addEventListener("click", handleLogin);
password_input.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    handleLogin();
  }
});

async function handleLogin() {
  const email = email_input.value.trim();
  const password = password_input.value;

  if (!email || !password) {
    showError("Please enter both email and password");
    return;
  }

  login_btn.disabled = true;
  login_btn.textContent = "Logging in...";

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      showError(error.message || "Login failed");
      console.error("Login error:", error);
      login_btn.disabled = false;
      login_btn.textContent = "Login";
      return;
    }

    if (data.session) {
      console.log("Login successful!", data.user);
      loginSuccess();
    }
  } catch (err) {
    showError("An error occurred during login");
    console.error(err);
    login_btn.disabled = false;
    login_btn.textContent = "Login";
  }
}

function showError(message) {
  login_label.textContent = message;
  login_label.style.display = "block";
  login_label.className = "login-error";
}

function showInfo(message) {
  login_label.textContent = message;
  login_label.style.display = "block";
  login_label.className = "login-info";
}

async function checkAuth() {
  const { data, error } = await db.auth.getSession();
  if (data.session) {
    console.log("User already logged in:", data.session.user);
    loginSuccess();
  }
}

checkAuth();

function loginSuccess() {
  console.log("Login successful! Changing view...");
  document.querySelector(".login-view").style.display = "none";

  const params = new URLSearchParams(window.location.search);
  const story = params.get("name");
  if (story) {
    console.log("Loading story:", story);
    showEditorView(story);
  } else {
    console.log("No story specified, loading default editor view");
    showListView();
  }
}

async function showListView() {
  document.querySelector(".list-view").style.display = "block";

  const storyGrid = document.querySelector(".story-grid");

  // Hydrate the list view with stories from the database
  try {
    const { data: stories, error } = await db
      .from("stories")
      .select("id, title, url_safe_name, summary")
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!stories || stories.length === 0) {
      storyGrid.innerHTML =
        "<p>No stories found. Create using the button above!</p>";
      return;
    }

    storyGrid.innerHTML = stories
      .map(
        (story) => `
            <a href="?name=${story.url_safe_name}">
              <h2>${story.title}</h2>
              <p>${story.summary}</p>
            </a>
        `,
      )
      .join("");

    storyGrid.innerHTML =
      `
        <a href="?name=CREATE_NEW" class="new-story">
        <p></p>
          <h2>Create New Story + </h2>
        </a>
      ` + storyGrid.innerHTML;
  } catch (err) {
    console.error("Hydration failed:", err.message);
    storyGrid.innerHTML = `
            <p>Unable to load stories at this time.</p>
            <small>${err.message}</small>
        `;
  }
}

async function showEditorView(storyName) {
  document.querySelector(".editor-view").style.display = "block";

  if (storyName === "CREATE_NEW") {
    story_title.value = "";
    story_summary.textContent = "";
    story_body.textContent = "";
    story_part.value = "1";
    comment_enabled.checked = true;
    save_btn.onclick = async () => {
      await createNewStory();
    };
  } else {
    try {
      const { data: story, error } = await db
        .from("stories")
        .select("*")
        .eq("url_safe_name", storyName)
        .single();

      if (error || !story) {
        window.history.replaceState(null, "", window.location.pathname);
        document.querySelector(".editor-view").style.display = "none";
        showListView();
        return;
      }

      story_title.value = story.title || "";
      story_summary.textContent = story.summary || "";
      story_body.textContent = story.body || "";
      story_part.value = story.part || "1";
      console.log("Story comments:", story.comments);
      comment_enabled.checked = story.comments || false;

      save_btn.onclick = async () => {
        await updateStory(story.id);
      };
    } catch (err) {
      console.error("Error loading story:", err);
      window.history.replaceState(null, "", window.location.pathname);
      document.querySelector(".editor-view").style.display = "none";
      showListView();
    }
  }
}

async function createNewStory() {
  const title = story_title.value.trim();
  const summary = story_summary.textContent.trim();
  const content = story_body.textContent.trim();

  if (!title || !content) {
    alert("Please fill in both title and content");
    return;
  }

  if (!summary) {
    alert("Please fill in the summary");
    return;
  }

  const url_safe_name = `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-part-${story_part.value}`;

  try {
    // Check if story with this url_safe_name already exists
    const { data: existingStory, error: checkError } = await db
      .from("stories")
      .select("id")
      .eq("url_safe_name", url_safe_name)
      .single();

    if (existingStory) {
      alert(
        `A story with the title "${title}" (Part ${story_part.value}) already exists!\n\nPlease change either the title or the part number.`,
      );
      return;
    }

    const { error } = await db.from("stories").insert({
      title,
      summary,
      body: content,
      part: parseInt(story_part.value),
      comments: comment_enabled.checked,
      url_safe_name,
    });

    if (error) throw error;

    console.log("Story created successfully!");
    window.location.href = window.location.pathname;
  } catch (err) {
    console.error("Error creating story:", err);
    alert("Failed to create story: " + err.message);
  }
}

async function updateStory(storyId) {
  const title = story_title.value.trim();
  const summary = story_summary.textContent.trim();
  const content = story_body.textContent.trim();

  if (!title || !content || !summary) {
    alert("Please fill in title, summary, and content");
    return;
  }

  try {
    const { error } = await db
      .from("stories")
      .update({
        title,
        summary,
        body: content,
        part: parseInt(story_part.value),
        comments: comment_enabled.checked,
      })
      .eq("id", storyId);

    if (error) throw error;

    console.log("Story updated successfully!");
    alert("Story saved!");
  } catch (err) {
    console.error("Error updating story:", err);
    alert("Failed to save story");
  }
}
