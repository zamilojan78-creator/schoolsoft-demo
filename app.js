import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

// ✅ YOUR WEB FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBiXlYCEV2eEuQQBJRozqrNl8cwj5Yx2Ls",
  authDomain: "al-mujahid-school-app.firebaseapp.com",
  projectId: "al-mujahid-school-app",
  storageBucket: "al-mujahid-school-app.firebasestorage.app",
  messagingSenderId: "107587927370",
  appId: "1:107587927370:web:478cd1ef83ad83d472d5b3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// UI
const loginWrap = document.getElementById("loginWrap");
const appWrap = document.getElementById("appWrap");
const authStatus = document.getElementById("authStatus");
const logoutBtn = document.getElementById("logoutBtn");

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value.trim();
  if (!email || !pass) return alert("Enter email & password");

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    alert(e.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// In-memory arrays (for printing + counts)
window.students = [];
window.teachers = [];
window.fees = [];
window.gallery = [];

// ---------- Preview handlers ----------
function previewSingle(input, previewId){
  const preview = document.getElementById(previewId);
  preview.innerHTML = "";
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.createElement("img");
    img.src = e.target.result;
    preview.appendChild(img);
  };
  reader.readAsDataURL(file);
}
function previewMulti(input, previewId){
  const preview = document.getElementById(previewId);
  preview.innerHTML = "";
  const files = input.files || [];
  [...files].forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("simage").addEventListener("change", (e) => previewSingle(e.target, "studentPreview"));
  document.getElementById("timage").addEventListener("change", (e) => previewSingle(e.target, "teacherPreview"));
  document.getElementById("gimages").addEventListener("change", (e) => previewMulti(e.target, "galleryPreview"));
});

// ---------- Helpers ----------
function escapeHtml(str){
  return String(str).replace(/[&<>\"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[s] || s));
}

async function uploadImage(file, prefix){
  if(!file) return "";
  const safeName = `${Date.now()}_${file.name.replace(/\s+/g,"_")}`;
  const storageRef = ref(storage, `${prefix}/${safeName}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

function createCard(data, type){
  const card = document.createElement("div");
  card.className = "card";

  if (data.img) card.innerHTML += `<img src="${data.img}" alt="">`;
  card.innerHTML += `<h3>${escapeHtml(data.name || "")}</h3>`;

  if (data.phone) card.innerHTML += `<p>Phone: ${escapeHtml(data.phone)}</p>`;

  if (type === "student") card.innerHTML += `<p>Class: ${escapeHtml(data.cls || "")}</p>`;
  if (type === "teacher") card.innerHTML += `
    <p>Classes: ${escapeHtml(data.classes || "")}</p>
    <p>Subject: ${escapeHtml(data.subject || "")}</p>
    <p>Designation: ${escapeHtml(data.designation || "")}</p>
  `;
  if (type === "fee") card.innerHTML += `
    <p>Amount: ${escapeHtml(String(data.amount ?? ""))}</p>
    <p>Month: ${escapeHtml(data.month || "")}</p>
  `;
  if (type === "gallery" && data.caption) card.innerHTML += `<p>${escapeHtml(data.caption)}</p>`;

  card.innerHTML += `<div class="card-buttons"><button class="deleteBtn">Delete</button></div>`;
  return card;
}

function updateCounts(){
  document.getElementById("studentCount").innerText = window.students.length;
  document.getElementById("teacherCount").innerText = window.teachers.length;
  document.getElementById("feeCount").innerText = window.fees.length;
  document.getElementById("galleryCount").innerText = window.gallery.length;
  if (window.updatePrintContainer) window.updatePrintContainer();
}

window.updatePrintContainer = function(){
  const container = document.getElementById("printAllContainer");
  container.innerHTML = "";
  window.students.forEach(s => container.appendChild(createCard(s, "student")));
  window.teachers.forEach(t => container.appendChild(createCard(t, "teacher")));
  window.fees.forEach(f => container.appendChild(createCard(f, "fee")));
  window.gallery.forEach(g => container.appendChild(createCard(g, "gallery")));
};

function clearAllCards(){
  document.getElementById("studentCards").innerHTML="";
  document.getElementById("dashStudentCards").innerHTML="";
  document.getElementById("teacherCards").innerHTML="";
  document.getElementById("dashTeacherCards").innerHTML="";
  document.getElementById("feeCards").innerHTML="";
  document.getElementById("dashFeeCards").innerHTML="";
  document.getElementById("galleryContainer").innerHTML="";
  document.getElementById("dashGallery").innerHTML="";

  window.students = [];
  window.teachers = [];
  window.fees = [];
  window.gallery = [];
  updateCounts();
}

// ---------- CRUD: Add ----------
window.addStudent = async function(){
  const name = document.getElementById("sname").value.trim();
  const phone = document.getElementById("sphone").value.trim();
  const cls = document.getElementById("sclass").value;
  const file = document.getElementById("simage").files[0] || null;

  if(!name || !phone || !cls) return alert("Fill all fields");
  if(phone.length !== 11) return alert("Phone must be 11 digits");

  try{
    const img = await uploadImage(file, "students");
    await addDoc(collection(db, "students"), { name, phone, cls, img, createdAt: serverTimestamp() });

    document.getElementById("sname").value="";
    document.getElementById("sphone").value="";
    document.getElementById("sclass").value="";
    document.getElementById("simage").value="";
    document.getElementById("studentPreview").innerHTML="";
  }catch(e){
    alert(e.message);
  }
};

window.addTeacher = async function(){
  const name = document.getElementById("tname").value.trim();
  const phone = document.getElementById("tphone").value.trim();
  const classes = Array.from(document.getElementById("tclasses").selectedOptions).map(o=>o.value).join(", ");
  const subject = document.getElementById("tsubject").value.trim();
  const designation = document.getElementById("tdesignation").value.trim();
  const file = document.getElementById("timage").files[0] || null;

  if(!name || !phone || !classes || !subject || !designation) return alert("Fill all fields");
  if(phone.length !== 11) return alert("Phone must be 11 digits");

  try{
    const img = await uploadImage(file, "teachers");
    await addDoc(collection(db, "teachers"), { name, phone, classes, subject, designation, img, createdAt: serverTimestamp() });

    document.getElementById("tname").value="";
    document.getElementById("tphone").value="";
    document.getElementById("tclasses").selectedIndex = -1;
    document.getElementById("tsubject").value="";
    document.getElementById("tdesignation").value="";
    document.getElementById("timage").value="";
    document.getElementById("teacherPreview").innerHTML="";
  }catch(e){
    alert(e.message);
  }
};

window.addFee = async function(){
  const name = document.getElementById("fname").value.trim();
  const amount = document.getElementById("famount").value.trim();
  const month = document.getElementById("fmonth").value;

  if(!name || !amount) return alert("Fill all fields");

  try{
    await addDoc(collection(db, "fees"), { name, amount: Number(amount), month, createdAt: serverTimestamp() });
    document.getElementById("fname").value="";
    document.getElementById("famount").value="";
  }catch(e){
    alert(e.message);
  }
};

window.addGallery = async function(){
  const files = document.getElementById("gimages").files;
  const caption = document.getElementById("gcaption").value.trim();
  if(!files || !files.length) return alert("Select at least one image");

  try{
    for (const file of files){
      const img = await uploadImage(file, "gallery");
      await addDoc(collection(db, "gallery"), { name:"Gallery", img, caption, createdAt: serverTimestamp() });
    }

    document.getElementById("gimages").value="";
    document.getElementById("gcaption").value="";
    document.getElementById("galleryPreview").innerHTML="";
  }catch(e){
    alert(e.message);
  }
};

// ---------- Delete ----------
async function deleteById(colName, id){
  if(!confirm("Are you sure to delete?")) return;
  await deleteDoc(doc(db, colName, id));
}

// ---------- Realtime listeners ----------
let unsubscribers = [];
function stopRealtime(){
  unsubscribers.forEach(fn => { try{ fn(); }catch{} });
  unsubscribers = [];
}
function startRealtime(){
  stopRealtime();

  unsubscribers.push(
    onSnapshot(query(collection(db,"students"), orderBy("createdAt","desc")), (snap)=>{
      window.students = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      renderAll();
    })
  );
  unsubscribers.push(
    onSnapshot(query(collection(db,"teachers"), orderBy("createdAt","desc")), (snap)=>{
      window.teachers = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      renderAll();
    })
  );
  unsubscribers.push(
    onSnapshot(query(collection(db,"fees"), orderBy("createdAt","desc")), (snap)=>{
      window.fees = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      renderAll();
    })
  );
  unsubscribers.push(
    onSnapshot(query(collection(db,"gallery"), orderBy("createdAt","desc")), (snap)=>{
      window.gallery = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      renderAll();
    })
  );
}

function renderAll(){
  // clear
  document.getElementById("studentCards").innerHTML="";
  document.getElementById("dashStudentCards").innerHTML="";
  document.getElementById("teacherCards").innerHTML="";
  document.getElementById("dashTeacherCards").innerHTML="";
  document.getElementById("feeCards").innerHTML="";
  document.getElementById("dashFeeCards").innerHTML="";
  document.getElementById("galleryContainer").innerHTML="";
  document.getElementById("dashGallery").innerHTML="";

  // students
  window.students.forEach(s=>{
    const dash = createCard(s,"student");
    dash.querySelector(".deleteBtn").onclick = ()=>deleteById("students", s.id);

    const page = dash.cloneNode(true);
    page.querySelector(".deleteBtn").onclick = ()=>deleteById("students", s.id);

    document.getElementById("dashStudentCards").appendChild(dash);
    document.getElementById("studentCards").appendChild(page);
  });

  // teachers
  window.teachers.forEach(t=>{
    const dash = createCard(t,"teacher");
    dash.querySelector(".deleteBtn").onclick = ()=>deleteById("teachers", t.id);

    const page = dash.cloneNode(true);
    page.querySelector(".deleteBtn").onclick = ()=>deleteById("teachers", t.id);

    document.getElementById("dashTeacherCards").appendChild(dash);
    document.getElementById("teacherCards").appendChild(page);
  });

  // fees
  window.fees.forEach(f=>{
    const data = { name:f.name, amount:f.amount, month:f.month };
    const dash = createCard(data,"fee");
    dash.querySelector(".deleteBtn").onclick = ()=>deleteById("fees", f.id);

    const page = dash.cloneNode(true);
    page.querySelector(".deleteBtn").onclick = ()=>deleteById("fees", f.id);

    document.getElementById("dashFeeCards").appendChild(dash);
    document.getElementById("feeCards").appendChild(page);
  });

  // gallery
  window.gallery.forEach(g=>{
    const data = { name:"Gallery", img:g.img, caption:g.caption };
    const dash = createCard(data,"gallery");
    dash.querySelector(".deleteBtn").onclick = ()=>deleteById("gallery", g.id);

    const page = dash.cloneNode(true);
    page.querySelector(".deleteBtn").onclick = ()=>deleteById("gallery", g.id);

    document.getElementById("dashGallery").appendChild(dash);
    document.getElementById("galleryContainer").appendChild(page);
  });

  updateCounts();
}

// ---------- Auth state ----------
onAuthStateChanged(auth, (user)=>{
  if(user){
    authStatus.textContent = `Logged in: ${user.email}`;
    loginWrap.classList.add("hidden");
    appWrap.classList.remove("hidden");
    startRealtime();
  }else{
    authStatus.textContent = "Not logged in";
    appWrap.classList.add("hidden");
    loginWrap.classList.remove("hidden");
    stopRealtime();
    clearAllCards();
  }
});
