onmessage = (e) => {

  const findVMsInRecord = (record, keys) => keys.flatMap((key) => (record[key] ? [record[key]] : []));

  const sortByName = (data) => {
    const getName = (obj) => obj.name || obj.metadata?.name || '';
    return (data || []).sort((a, b) => (getName(a) < getName(b) ? -1 : 1));
  };

  const indexVMs = (vms) => {
    const sortedVMs = sortByName(vms.filter((vm) => !(vm).isTemplate));
    const vmsById = {};
    const vmsBySelfLink = {};
    sortedVMs.forEach((vm) => {
      vmsById[vm.id] = vm;
      vmsBySelfLink[vm.selfLink] = vm;
    });
    return {
      vms: sortedVMs,
      vmsById,
      vmsBySelfLink,
      findVMsByIds: (ids) => findVMsInRecord(vmsById, ids),
      findVMsBySelfLinks: (selfLinks) => findVMsInRecord(vmsBySelfLink, selfLinks),
    };
  };

  const finalResult = indexVMs(e.data);

  postMessage({
    vms: finalResult.vms,
    vmsById: finalResult.vmsById,
    vmsBySelfLink: finalResult.vmsBySelfLink
  });

  // const resultBuff = new ArrayBuffer(finalResult);
  // postMessage(resultBuff, [resultBuff]);
}
