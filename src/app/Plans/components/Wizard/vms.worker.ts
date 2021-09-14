import { SourceVM, IVMwareVM, SourceVMsRecord } from '@app/queries/types/vms.types';
import { IndexedSourceVMs } from '@app/queries';

onmessage = (e) => {

  const findVMsInRecord = (record: SourceVMsRecord, keys: string[]) =>
    keys.flatMap((key) => (record[key] ? [record[key]] : [])) as SourceVM[];

  const sortByName = (data) => {
    const getName = (obj) => obj.name || obj.metadata?.name || '';
    return (data || []).sort((a, b) => (getName(a) < getName(b) ? -1 : 1));
  };

  const indexVMs = (vms: SourceVM[]): IndexedSourceVMs => {
    const sortedVMs = sortByName(vms.filter((vm) => !(vm as IVMwareVM).isTemplate));
    const vmsById: SourceVMsRecord = {};
    const vmsBySelfLink: SourceVMsRecord = {};
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

}
