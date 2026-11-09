(function(){
  var navToggle=document.getElementById('navToggle');
  var navLinks=document.getElementById('navLinks');
  var topnav=document.getElementById('topnav');
  if(navToggle) navToggle.addEventListener('click',function(){
    var o=navLinks.classList.toggle('open'); navToggle.setAttribute('aria-expanded',o?'true':'false');
  });
  window.addEventListener('scroll',function(){topnav.classList.toggle('solid',window.scrollY>40);},{passive:true});
  topnav.classList.toggle('solid',window.scrollY>40);

  window.sendContactForm=function(e){
    e.preventDefault();
    var topic=document.getElementById('cf-topic').value;
    var email=document.getElementById('cf-email').value.trim();
    var message=document.getElementById('cf-message').value.trim();
    if(!email||!message){return false;}
    var to='unclekyoshi@gmail.com';
    var subject='Formularz kontaktowy — '+topic;
    var body='Temat: '+topic+'\nOd: '+email+'\n\n'+message;
    window.location.href='mailto:'+to+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    return false;
  };

  window.goSub=function(id,keepHash){
    document.querySelectorAll('.subpage').forEach(function(el){el.classList.toggle('active',el.id==='sub-'+id);});
    document.querySelectorAll('.subnav button').forEach(function(b){b.classList.toggle('active',b.dataset.sub===id);});
    if(!keepHash&&window.history&&history.replaceState) history.replaceState(null,'','#'+id);
  };
  var h=(location.hash||'').replace('#','');
  if(h&&document.getElementById('sub-'+h)) goSub(h,true);
})();
