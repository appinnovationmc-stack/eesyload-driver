async function requestDriverPayout() {
  const user = await sbGetCurrentUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await sb.from('payout_requests').insert({
    driver_id: user.id,
    status: 'pending',
    requested_at: new Date().toISOString()
  });
  if (error) throw error;
  alert('Payout requested. EesyLoad will process this manually until Paystack transfers are live.');
}
