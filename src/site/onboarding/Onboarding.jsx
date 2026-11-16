// City Healer patient onboarding, from "City_Healer_Patient_Onboarding_Source (1).zip" (src/main.jsx), used as supplied.
// Changes: exported instead of mounting itself; "motion/react" (the same library as framer-motion,
// already in this project); the language follows the /en and /hi address; styles scoped to .cho.
// Connected to the app through Firebase: step 2 is a real phone OTP (Firebase Phone Auth, as in
// City_Healer_Backend_Auth_Foundation.zip) or email and password; "Create my account" saves the
// profile and the consent to Firestore (PUT /api/v1/me/profile, POST /api/v1/me/consents) and opens
// the dashboard. Someone already signed in without a profile starts at step 3. Someone with a
// finished profile but no valid consent (never recorded, withdrawn, or the terms changed) sees
// only the consent step: the server refuses their health data until it is recorded.
import React,{useState} from "react";
import{motion,AnimatePresence,useReducedMotion}from"motion/react";
import { useI18n } from "../i18n";
import { useNavigate, Link } from "react-router-dom";
import { auth, registerAccount, requestPhoneOtp, confirmPhoneOtp, savePatientProfile, recordConsent, usingFirebaseEmulators, TERMS_VERSION, PRIVACY_VERSION } from "../../firebase";
import { useSession } from "../lib/session";
import{HeartPulse,ArrowLeft,ArrowRight,Check,ShieldCheck,UserRound,Users,MapPin,Phone,Mail,Globe2,Info,LockKeyhole}from"lucide-react";
import"./onboarding.css";
const C={
en:{reviewQ:"Please review our terms to continue.",reviewD:"We need your agreement to the current Terms and Privacy notice before we can show or use your health information.",agree:"Agree and continue",reviewDone:"Thank you. You’re all set.",tag:"CITY HEALER · CONNECTED CARE",headline:"Your care journey, in your hands.",intro:"A few simple steps to make your City Healer experience feel like yours.",step:"Step",roleQ:"Who are you setting this up for?",roleD:"Choose the option that best describes how you’ll use City Healer.",self:"Myself",selfD:"I’m managing my own health.",family:"A family member",familyD:"I help someone I care about.",contactQ:"How can we reach you?",contactD:"Use your mobile number (we’ll send a 6-digit code) or your email address with a password.",mobile:"Mobile number",email:"Email address",name:"Full name",dob:"Date of birth (optional)",gender:"Gender (optional)",prefer:"Prefer not to say",female:"Female",male:"Male",other:"Another identity",locationQ:"Where should we look for care?",locationD:"Choose your city to see relevant services when available. You can change this later.",city:"City",locality:"Locality / sector (optional)",localityP:"e.g. Sector 62, Indirapuram",privacyQ:"Your health information stays yours.",privacyD:"Choose how you want to proceed. You can review permissions later.",required:"Required",terms:"I agree to the Terms of Use and acknowledge the Privacy Notice.",optional:"Optional",updates:"I’d like to receive product updates and service announcements.",abha:"ABHA is optional",abhaD:"You can connect an ABHA number later if you choose. It is not required.",next:"Continue",verify:"Verify and continue",finish:"Create my account",back:"Back",demo:"Your details are used only to set up your account. Health information is never shared without your permission.",password:"Password",passwordHint:"At least 8 characters. Don’t reuse your email address.",sendCode:"Send code",resend:"Send a new code",codeLabel:"6-digit code",codeSent:"We sent a code to",codeError:"Send the code first, then enter the 6 digits from the SMS.",phoneError:"Enter a valid Indian mobile number (10 digits, starting 6 to 9).",emulatorHint:"Local test mode: no SMS is sent. The code is shown in the Firebase emulator at http://127.0.0.1:4000/auth.",haveAccount:"Already have an account?",signin:"Sign in",creating:"Creating your account…",success:"You’re ready to begin.",successD:"Your City Healer account is ready. You can update these details any time in Settings.",home:"Open my dashboard",restart:"Review onboarding",privacy:"Privacy-first by design",secure:"Your information is handled with care.",error:"Please complete the required fields.",contactError:"Enter a valid email address and a password of at least 8 characters.",termsError:"Please accept the required terms to continue.",useLoc:"Use my current location",locNote:"Location access is optional. You can select your city manually.",choose:"Choose your city",lang:"हिन्दी"},
hi:{reviewQ:"आगे बढ़ने के लिए कृपया हमारी शर्तें देखें।",reviewD:"आपकी स्वास्थ्य जानकारी दिखाने या उपयोग करने से पहले हमें मौजूदा शर्तों और गोपनीयता सूचना पर आपकी सहमति चाहिए।",agree:"सहमत हूँ, आगे बढ़ें",reviewDone:"धन्यवाद। सब तैयार है।",tag:"CITY HEALER · जुड़ी हुई देखभाल",headline:"आपकी देखभाल, आपके हाथों में।",intro:"City Healer अनुभव को आपके अनुसार बनाने के लिए कुछ आसान कदम।",step:"चरण",roleQ:"आप किसके लिए अकाउंट बना रहे हैं?",roleD:"वह विकल्प चुनें जो आपके उपयोग को सबसे बेहतर बताता है।",self:"अपने लिए",selfD:"मैं अपनी सेहत का ध्यान रखता/रखती हूँ।",family:"परिवार के किसी सदस्य के लिए",familyD:"मैं अपने किसी प्रियजन की देखभाल में मदद करता/करती हूँ।",contactQ:"आपसे कैसे संपर्क करें?",contactD:"अपना मोबाइल नंबर डालें (हम 6 अंकों का कोड भेजेंगे) या ईमेल और पासवर्ड।",mobile:"मोबाइल नंबर",email:"ईमेल पता",name:"पूरा नाम",dob:"जन्मतिथि (वैकल्पिक)",gender:"लिंग (वैकल्पिक)",prefer:"बताना नहीं चाहते",female:"महिला",male:"पुरुष",other:"अन्य पहचान",locationQ:"आप कहाँ देखभाल खोजना चाहते हैं?",locationD:"सेवाएँ उपलब्ध होने पर दिखाने के लिए अपना शहर चुनें। इसे बाद में बदला जा सकता है।",city:"शहर",locality:"इलाका / सेक्टर (वैकल्पिक)",localityP:"जैसे सेक्टर 62, इंदिरापुरम",privacyQ:"आपकी स्वास्थ्य जानकारी आपकी है।",privacyD:"आगे बढ़ने का तरीका चुनें। अनुमतियाँ बाद में बदल सकते हैं।",required:"ज़रूरी",terms:"मैं उपयोग की शर्तों से सहमत हूँ और प्राइवेसी नोटिस स्वीकार करता/करती हूँ।",optional:"वैकल्पिक",updates:"मैं प्रोडक्ट अपडेट और सेवा संबंधी सूचनाएँ पाना चाहता/चाहती हूँ।",abha:"ABHA वैकल्पिक है",abhaD:"चाहें तो बाद में ABHA नंबर जोड़ सकते हैं। यह ज़रूरी नहीं है।",next:"आगे बढ़ें",verify:"सत्यापित करें और आगे बढ़ें",finish:"मेरा अकाउंट बनाएँ",back:"पीछे",demo:"आपकी जानकारी केवल अकाउंट बनाने के लिए है। आपकी अनुमति के बिना स्वास्थ्य जानकारी साझा नहीं होती।",password:"पासवर्ड",passwordHint:"कम से कम 8 अक्षर। अपना ईमेल पासवर्ड के रूप में न रखें।",sendCode:"कोड भेजें",resend:"नया कोड भेजें",codeLabel:"6 अंकों का कोड",codeSent:"कोड भेजा गया:",codeError:"पहले कोड भेजें, फिर SMS के 6 अंक डालें।",phoneError:"सही भारतीय मोबाइल नंबर डालें (10 अंक, 6 से 9 से शुरू)।",emulatorHint:"लोकल टेस्ट मोड: SMS नहीं भेजा जाता। कोड Firebase emulator में दिखता है: http://127.0.0.1:4000/auth",haveAccount:"पहले से अकाउंट है?",signin:"लॉग इन",creating:"अकाउंट बन रहा है…",success:"आप शुरुआत के लिए तैयार हैं।",successD:"आपका City Healer अकाउंट तैयार है। ये जानकारी कभी भी सेटिंग्स में बदल सकते हैं।",home:"मेरा डैशबोर्ड खोलें",restart:"फिर से देखें",privacy:"प्राइवेसी को प्राथमिकता",secure:"आपकी जानकारी का ध्यान रखा जाएगा।",error:"कृपया ज़रूरी जानकारी भरें।",contactError:"सही ईमेल पता और कम से कम 8 अक्षरों का पासवर्ड दर्ज करें।",termsError:"आगे बढ़ने के लिए ज़रूरी शर्तें स्वीकार करें।",useLoc:"मेरी मौजूदा लोकेशन इस्तेमाल करें",locNote:"लोकेशन देना वैकल्पिक है। आप शहर खुद चुन सकते हैं।",choose:"शहर चुनें",lang:"English"}
};
const cities=["Delhi","Gurugram","Noida","Greater Noida","Ghaziabad","Faridabad"];
export default function Onboarding(){
const { locale, switchLocale, href } = useI18n();
const lang=locale, setLang=(l)=>switchLocale(l);
const navigate=useNavigate();
const session=useSession();
const[password,P]=useState(""),[busy,B]=useState(false),[sentTo,Sent]=useState(""),[sending,Sending]=useState(false);
// Signed in with a finished profile: nothing to set up. Signed in without one (a verified phone,
// or an account moved from the old system): continue from step 3.
// (not while this page is saving: that is what completes the profile)
// If the account could not be read, nothing here can tell what is missing: the dashboard route
// shows a retry and stays closed (a sign-up already past step 2 carries on; its saves report errors).
React.useEffect(()=>{if(!session.ready||!session.user||busy)return;
  if(session.checkFailed){if(step<3)navigate(href("/dashboard"),{replace:true});return}
  if(!session.needsOnboarding&&step<6)navigate(href("/dashboard"),{replace:true});
  else if(session.needsConsentOnly&&step<5){N(session.profile?.fullName||"");City(session.profile?.city||"");T(session.user.phoneNumber?"mobile":"email");Reconsent(true);S(5)}
  else if(session.needsOnboarding&&!session.needsConsentOnly&&step<3)S(3)},[session.ready,session.user,session.needsOnboarding,session.needsConsentOnly,session.checkFailed,busy]);
// Consent-only visit: the profile exists, so only the consent is recorded.
const[reconsent,Reconsent]=useState(false);
const[step,S]=useState(1),[role,R]=useState("self"),[type,T]=useState("mobile"),[contact,Ct]=useState(""),[otp,O]=useState(""),[name,N]=useState(""),[dob,D]=useState(""),[gender,G]=useState(""),[city,City]=useState(""),[locality,L]=useState(""),[terms,Terms]=useState(false),[updates,Updates]=useState(false),[err,E]=useState("");
const t=C[lang],reduced=useReducedMotion(),max=5;
const next=()=>{E("");if(step===2){if(type==="mobile"){verifyPhone();return}let ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim())&&password.length>=8;if(!ok){E(t.contactError);return}}if(step===3&&!name.trim()){E(t.error);return}if(step===4&&!city){E(t.error);return}if(step===5&&!terms){E(t.termsError);return}if(step===5){create();return}S(v=>v+1)};
// Phone: send the code (Firebase Phone Auth), then verifying it signs the person in.
const sendCode=async()=>{E("");Sending(true);try{const to=await requestPhoneOtp(contact,"recaptcha-container");Sent(to);O("")}catch(err){E(err?.code==="auth/invalid-phone-number"?t.phoneError:(err?.message||t.error))}finally{Sending(false)}};
const verifyPhone=async()=>{if(!sentTo||!/^\d{6}$/.test(otp)){E(t.codeError);return}B(true);E("");try{await confirmPhoneOtp(otp);S(3)}catch(err){E(err?.message||t.error)}finally{B(false)}};
// Creates the account (email) or completes it (phone, already signed in), saving the profile and
// the consent to Firestore. Only what the person entered; nothing optional is invented.
const GENDERS={[C.en.female]:"female",[C.hi.female]:"female",[C.en.male]:"male",[C.hi.male]:"male",[C.en.other]:"other",[C.hi.other]:"other"};
const create=async()=>{B(true);E("");try{
  if(reconsent){
    await recordConsent({termsAccepted:true,termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION,marketingOptIn:updates});
    session.refresh();S(6);return;
  }
  const profile={city,preferredLanguage:lang,...(locality.trim()?{locality:locality.trim()}:{}),...(dob?{dateOfBirth:dob}:{}),...(GENDERS[gender]?{gender:GENDERS[gender]}:{gender:"prefer_not_to_say"})};
  if(auth.currentUser){
    await savePatientProfile({fullName:name.trim(),...profile});
    await recordConsent({termsAccepted:true,termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION,marketingOptIn:updates});
  }else{
    await registerAccount(auth,{name:name.trim(),email:contact.trim(),password,profile,consent:{marketingOptIn:updates}});
  }
  try{localStorage.setItem("ch_city",city)}catch{}
  session.refresh();S(6);
}catch(err){E(err?.message||t.error)}finally{B(false)}};
const back=()=>{E("");S(v=>Math.max(1,v-1))};
const progress=Math.min(step,max)/max*100;
const panel={initial:{opacity:0,x:reduced?0:18},animate:{opacity:1,x:0},exit:{opacity:0,x:reduced?0:-18},transition:{duration:.22}};
return <div className="cho"><div className={"app "+(lang==="hi"?"hindi":"")}>
<header><Link className="brand" to={href("/")}><span className="mark"><HeartPulse/></span>city<span className="light">healer</span></Link><div className="navright"><span><ShieldCheck size={15}/> {t.privacy}</span><button onClick={()=>setLang(lang==="en"?"hi":"en")}><Globe2 size={15}/>{t.lang}</button></div></header>
<main><aside><div className="eyebrow"><i/>{t.tag}</div><h1>{t.headline}</h1><p>{t.intro}</p><div className="art"><div className="ring r1"/><div className="ring r2"/><div className="person"><UserRound size={78}/></div><div className="float"><span><HeartPulse/></span><div><b>{t.privacy}</b><small>{t.secure}</small></div><Check/></div><div className="pill"><ShieldCheck size={14}/>{t.secure}</div></div><small className="foot"><LockKeyhole size={13}/>{t.demo}</small></aside>
<section className="panel">
{step<=5&&!reconsent&&<><div className="progress-label"><span>{t.step} {step} / {max}</span><b>{Math.round(progress)}%</b></div><div className="progress"><i style={{width:progress+"%"}}/></div></>}
<AnimatePresence mode="wait">
{step===1&&<motion.div key="role" {...panel}><h2>{t.roleQ}</h2><p className="sub">{t.roleD}</p><div className="choices"><button className={role==="self"?"choice selected":"choice"} onClick={()=>R("self")}><span className="choiceicon"><UserRound/></span><span><b>{t.self}</b><small>{t.selfD}</small></span><i>{role==="self"&&<Check/>}</i></button><button className={role==="family"?"choice selected":"choice"} onClick={()=>R("family")}><span className="choiceicon green"><Users/></span><span><b>{t.family}</b><small>{t.familyD}</small></span><i>{role==="family"&&<Check/>}</i></button></div></motion.div>}
{step===2&&<motion.div key="contact" {...panel}><h2>{t.contactQ}</h2><p className="sub">{t.contactD}</p><div className="tabs"><button className={type==="mobile"?"active":""} onClick={()=>{T("mobile");Ct("");Sent("");E("")}}><Phone/>{t.mobile}</button><button className={type==="email"?"active":""} onClick={()=>{T("email");Ct("");Sent("");E("")}}><Mail/>{t.email}</button></div><label>{type==="mobile"?t.mobile:t.email}<input value={contact} onChange={e=>{Ct(e.target.value);Sent("")}} autoComplete={type==="email"?"email":"tel"} type={type==="email"?"email":"tel"} placeholder={type==="mobile"?"+91 98765 43210":"you@example.com"}/></label>{type==="email"?<><label>{t.password}<input type="password" autoComplete="new-password" value={password} onChange={e=>P(e.target.value)} placeholder="••••••••"/></label><div className="hint"><Info size={14}/>{t.passwordHint}</div></>
:<>{sentTo?<label>{t.codeLabel}<input inputMode="numeric" autoComplete="one-time-code" maxLength="6" value={otp} onChange={e=>O(e.target.value.replace(/\D/g,""))} placeholder="••••••"/></label>:null}
<div className="hint"><Info size={14}/>{sentTo?`${t.codeSent} ${sentTo}`:t.contactD}</div>
<button type="button" className="back" style={{marginTop:12}} onClick={sendCode} disabled={sending}>{sending?"…":sentTo?t.resend:t.sendCode}<ArrowRight/></button>
{usingFirebaseEmulators&&<div className="hint" style={{marginTop:10}}><Info size={14}/>{t.emulatorHint}</div>}</>}
<div id="recaptcha-container"/></motion.div>}
{step===3&&<motion.div key="profile" {...panel}><h2>{t.name}</h2><p className="sub">{t.intro}</p><label>{t.name}<input value={name} onChange={e=>N(e.target.value)} placeholder={t.name}/></label><label>{t.dob}<input type="date" value={dob} onChange={e=>D(e.target.value)}/></label><label>{t.gender}<select value={gender} onChange={e=>G(e.target.value)}><option value="">{t.prefer}</option><option>{t.female}</option><option>{t.male}</option><option>{t.other}</option></select></label></motion.div>}
{step===4&&<motion.div key="city" {...panel}><h2>{t.locationQ}</h2><p className="sub">{t.locationD}</p><label>{t.city}<select value={city} onChange={e=>City(e.target.value)}><option value="">{t.choose}</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label><label>{t.locality}<input value={locality} onChange={e=>L(e.target.value)} placeholder={t.localityP}/></label><div className="hint"><MapPin size={14}/>{t.locNote}</div></motion.div>}
{step===5&&<motion.div key="privacy" {...panel}><h2>{reconsent?t.reviewQ:t.privacyQ}</h2><p className="sub">{reconsent?t.reviewD:t.privacyD}</p><div className="consent"><b>{t.required}</b><label className="check"><input type="checkbox" checked={terms} onChange={e=>Terms(e.target.checked)}/>{t.terms}</label></div><div className="consent"><b>{t.optional}</b><label className="check"><input type="checkbox" checked={updates} onChange={e=>Updates(e.target.checked)}/>{t.updates}</label></div><div className="abha"><ShieldCheck/><div><b>{t.abha}</b><small>{t.abhaD}</small></div></div></motion.div>}
{step===6&&<motion.div key="done" {...panel} className="complete"><span className="done"><Check/></span><h2>{reconsent?t.reviewDone:t.success}</h2><p className="sub">{t.successD}</p><div className="summary"><span>{t.name}<b>{name}</b></span><span>{t.city}<b>{city}</b></span><span>{type==="mobile"?t.mobile:t.email}<b>{auth.currentUser?.phoneNumber||auth.currentUser?.email||contact}</b></span></div><Link className="primary" to={href("/dashboard")}>{t.home}<ArrowRight/></Link></motion.div>}
</AnimatePresence>
{err&&<p className="error" role="alert">{err}</p>}
{step===1&&<p className="sub" style={{marginTop:18,marginBottom:0}}>{t.haveAccount} <Link to={href("/sign-in")} style={{color:"#0c91bb",fontWeight:600}}>{t.signin}</Link></p>}
{step<=5&&<div className="actions">{step>1&&!(step===3&&auth.currentUser)&&!reconsent?<button className="back" onClick={back}><ArrowLeft/>{t.back}</button>:<span/>}<button className="primary" onClick={next} disabled={busy}>{busy?t.creating:step===2&&type==="mobile"?t.verify:step===5?(reconsent?t.agree:t.finish):t.next}<ArrowRight/></button></div>}
</section></main>
<footer><span>© {new Date().getFullYear()} City Healer</span><span>Delhi NCR · India</span><span>{t.demo}</span></footer></div></div>
}
