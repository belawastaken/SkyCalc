document.getElementById('calc-btn').addEventListener('click', function() {
    const baseDamage = Number(document.getElementById('base-damage').value);
    const strength = Number(document.getElementById('strength').value);
    const critDamage = Number(document.getElementById('crit-damage').value);

    // Calculate 'Initial Damage'
    const initialDamage = 5 + baseDamage + (strength / 5);

    // Calculate 'Total Damage'
    const totalDamage = initialDamage * (1 + strength / 100);

    // Calculate 'Crit Damage'
    const resultCritDamage = totalDamage * (1 + critDamage / 100);

    document.getElementById('result-display').innerHTML = `Total Damage: ${Math.floor(totalDamage)}<br>Crit Damage: ${Math.floor(resultCritDamage)}`;
});