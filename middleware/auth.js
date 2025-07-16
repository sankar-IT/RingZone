const User=require('../models/userSchema')

const  userAuth=(req,res,next)=>{

  if(req.session.user){
    
    User.findById(req.session.user?._id)
    .then(data=>{
      if(data && !data.isBlocked){
        res.locals.user = req.session.user
        return next();
      }else{
        res.locals.user = null;
        return res.redirect('/login')
      }
    }).catch(error => {

      res.locals.user = null;
     
      return res.status(500).send(error.message)

    });

  }else{
   res.locals.user = null;
   res.redirect('/login')
  }
}
 


const adminAuth=(req,res,next)=>{
  if(req.session.admin && req.session.adminUser){

    User.findOne({isAdmin:true, _id: req.session.adminUser._id})
    .then(data=>{
    if(data){
      next();
    }else{
      res.redirect('/admin/login')
    }
  }).catch(error=>{
    res.status(500).send('Internal server error')
  })
}else{
  res.redirect('/admin/login')
}
}

module.exports={
  userAuth,
  adminAuth
}