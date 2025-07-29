const User=require('../models/userSchema')


function generateReferralCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'RIZ-'+ code;
}

async function getUniqueReferralCode() {
  let code;
  let exists = true;

  while (exists) {
    code = generateReferralCode();
    const existingUser = await User.findOne({ referralCode: code });
    if (!existingUser) exists = false;
  }

  return code;
}

module.exports = {
  getUniqueReferralCode
};
