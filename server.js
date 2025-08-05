require('dotenv').config()
const express=require('express');
const app=express();
const noCache = require('nocache');
const path=require('path');
const connectDB = require('./config/db')
const userRouter=require('./routes/userRouter')
const passport=require('./config/passport')
const session=require('express-session')
const adminRouter=require('./routes/adminRouter')
const injectCartCount = require('./middleware/cartMiddleware');
const wishlistCountMiddleware = require('./middleware/wishlistCountMiddleware');

connectDB()


app.use(express.json());
app.use(express.urlencoded({extended:true}));


app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,  
  cookie: {
    secure: false, 
    httpOnly: true,
    maxAge: 72 * 60 * 60 * 1000 
  }
}));

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  next();
});

app.use(noCache());
app.use(injectCartCount);
app.use(wishlistCountMiddleware);
app.use(passport.initialize());
app.use(passport.session());

app.set('view engine','ejs');
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')])
app.use(express.static(path.join(__dirname, 'public')));



app.use('/',userRouter);
app.use('/admin',adminRouter);

const errorHandler = require('./middleware/errorHandlingMiddleware');
app.use(errorHandler);

app.listen(process.env.PORT,()=>{console.log(`server Running on ${process.env.PORT}`)})

module.exports=app;